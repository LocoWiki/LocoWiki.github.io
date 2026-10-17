using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace LocoWiki.Desktop.Services;

public sealed record CachedResponse(
    byte[] Body,
    string ContentType,
    int StatusCode,
    string Source,
    IReadOnlyDictionary<string, string>? Headers = null);

/// <summary>
/// Network-first resource cache. Every request for the wiki origins is routed
/// through <see cref="ResolveAsync"/>: try the network, store a copy on disk on
/// success, and fall back to the disk copy (or the bundled snapshot) on failure.
/// </summary>
public sealed class SiteCache
{
    private const long MaxCacheBytes = 256L * 1024 * 1024;
    private const long MaxCacheableBodyBytes = 16L * 1024 * 1024;
    private const string UserAgent = "LocoWikiWindows/0.1 (+https://locowiki.com)";

    private readonly string _cacheRoot;
    private readonly string _bundleRoot;
    private readonly string _bundleRootFull;
    private readonly HttpClient _http;
    private readonly NetworkGate _network;
    private readonly object _pruneSync = new();
    private DateTime _lastPruneUtc = DateTime.MinValue;

    public SiteCache(string cacheRoot, string bundleRoot, NetworkGate network)
    {
        _cacheRoot = cacheRoot;
        _bundleRoot = bundleRoot;
        _bundleRootFull = Path.GetFullPath(bundleRoot);
        _network = network;

        Directory.CreateDirectory(_cacheRoot);

        var handler = new HttpClientHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            AllowAutoRedirect = true,
            UseCookies = false,
        };

        _http = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(7),
        };
        _http.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UserAgent);
    }

    public bool IsOnline => _network.IsOnline;

    public async Task<CachedResponse?> ResolveAsync(Uri uri, bool forceNetwork = false)
    {
        if (forceNetwork || _network.IsOnline)
        {
            var outcome = await FetchAsync(uri).ConfigureAwait(false);
            var fresh = outcome.Response;

            // locowiki.com occasionally lacks a page that GitHub Pages already
            // has (for example papers.html). Try the mirror before going stale.
            if (fresh is null && outcome.StatusCode == 404 && IsPrimaryHost(uri.Host))
            {
                var mirrorUri = new UriBuilder(uri)
                {
                    Host = "locowiki.github.io",
                    Port = -1,
                }.Uri;

                var mirror = await FetchAsync(mirrorUri).ConfigureAwait(false);
                if (mirror.Response is not null)
                {
                    Diagnostics.Log($"mirror fallback: {uri}");
                    fresh = mirror.Response;
                }
            }

            if (fresh is not null)
            {
                _network.MarkSuccess();
                await SaveAsync(uri, fresh).ConfigureAwait(false);
                return fresh with { Source = "network" };
            }

            _network.MarkFailure();
        }

        var cached = await ReadCachedAsync(uri).ConfigureAwait(false);
        if (cached is not null)
        {
            Diagnostics.Log($"offline fallback (cache): {uri}");
            return cached;
        }

        var bundled = ReadBundled(uri);
        if (bundled is not null)
        {
            Diagnostics.Log($"offline fallback (bundle): {uri}");
            return bundled;
        }

        Diagnostics.Log($"resource unavailable: {uri}");
        return null;
    }

    private static bool IsPrimaryHost(string host) =>
        string.Equals(host, "locowiki.com", StringComparison.OrdinalIgnoreCase)
        || string.Equals(host, "www.locowiki.com", StringComparison.OrdinalIgnoreCase);

    private async Task<FetchOutcome> FetchAsync(Uri uri)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.TryAddWithoutValidation("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
            request.Headers.TryAddWithoutValidation("Accept", "*/*");

            using var response = await _http
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead)
                .ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                Diagnostics.Log($"fetch status {(int)response.StatusCode}: {uri}");
                return new FetchOutcome(null, (int)response.StatusCode);
            }

            var body = await response.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
            var contentType = response.Content.Headers.ContentType?.ToString()
                              ?? GuessContentType(uri.AbsolutePath);

            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Content-Type"] = contentType,
            };

            if (response.Headers.TryGetValues("Access-Control-Allow-Origin", out var cors))
            {
                headers["Access-Control-Allow-Origin"] = string.Join(", ", cors);
            }

            return new FetchOutcome(new CachedResponse(body, contentType, 200, "network", headers), 200);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
        {
            Diagnostics.Log($"fetch failed: {uri} ({ex.GetType().Name}: {ex.Message})");
            return new FetchOutcome(null, 0);
        }
    }

    private async Task<CachedResponse?> ReadCachedAsync(Uri uri)
    {
        try
        {
            var key = KeyFor(uri);
            var bodyPath = Path.Combine(_cacheRoot, key + ".body");
            var metaPath = Path.Combine(_cacheRoot, key + ".meta.json");

            if (!File.Exists(bodyPath) || !File.Exists(metaPath)) return null;

            await using var metaStream = File.OpenRead(metaPath);
            var meta = await JsonSerializer.DeserializeAsync<CacheMeta>(metaStream).ConfigureAwait(false);
            if (meta is null) return null;

            var body = await File.ReadAllBytesAsync(bodyPath).ConfigureAwait(false);

            // Touch the entry so FIFO pruning keeps recently used resources.
            try { File.SetLastWriteTimeUtc(bodyPath, DateTime.UtcNow); } catch { }

            return new CachedResponse(
                body,
                meta.ContentType ?? GuessContentType(uri.AbsolutePath),
                meta.StatusCode,
                "cache",
                meta.Headers);
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private async Task SaveAsync(Uri uri, CachedResponse response)
    {
        if (response.StatusCode != 200 || response.Body.LongLength > MaxCacheableBodyBytes) return;

        try
        {
            var key = KeyFor(uri);
            var bodyPath = Path.Combine(_cacheRoot, key + ".body");
            var metaPath = Path.Combine(_cacheRoot, key + ".meta.json");

            var bodyTemp = $"{bodyPath}.{Guid.NewGuid():N}.tmp";
            await File.WriteAllBytesAsync(bodyTemp, response.Body).ConfigureAwait(false);
            File.Move(bodyTemp, bodyPath, overwrite: true);

            var meta = new CacheMeta
            {
                Url = uri.AbsoluteUri,
                ContentType = response.ContentType,
                StatusCode = response.StatusCode,
                Headers = response.Headers is null
                    ? new Dictionary<string, string>()
                    : new Dictionary<string, string>(response.Headers),
                SavedAtUtc = DateTime.UtcNow,
            };

            var metaTemp = $"{metaPath}.{Guid.NewGuid():N}.tmp";
            await File.WriteAllTextAsync(metaTemp, JsonSerializer.Serialize(meta)).ConfigureAwait(false);
            File.Move(metaTemp, metaPath, overwrite: true);

            MaybePrune();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // A cache write must never break browsing.
        }
    }

    private CachedResponse? ReadBundled(Uri uri)
    {
        if (!WebResourceInterceptor.IsSiteHost(uri.Host)) return null;

        try
        {
            var relative = Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/');
            if (string.IsNullOrEmpty(relative)) relative = "index.html";
            if (relative.EndsWith('/')) relative += "index.html";

            var fullPath = Path.GetFullPath(
                Path.Combine(_bundleRootFull, relative.Replace('/', Path.DirectorySeparatorChar)));

            if (!fullPath.StartsWith(_bundleRootFull + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            if (!File.Exists(fullPath)) return null;

            return new CachedResponse(
                File.ReadAllBytes(fullPath),
                GuessContentType(fullPath),
                200,
                "bundle");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            return null;
        }
    }

    public long GetCacheSizeBytes()
    {
        try
        {
            return Directory.EnumerateFiles(_cacheRoot, "*.body")
                .Sum(path =>
                {
                    try { return new FileInfo(path).Length; }
                    catch { return 0L; }
                });
        }
        catch
        {
            return 0L;
        }
    }

    public void ClearCache()
    {
        try
        {
            foreach (var file in Directory.EnumerateFiles(_cacheRoot))
            {
                File.Delete(file);
            }
        }
        catch
        {
            // Best effort.
        }
    }

    private void MaybePrune()
    {
        var now = DateTime.UtcNow;
        lock (_pruneSync)
        {
            if (now - _lastPruneUtc < TimeSpan.FromMinutes(10)) return;
            _lastPruneUtc = now;
        }

        _ = Task.Run(() =>
        {
            try
            {
                var files = Directory.EnumerateFiles(_cacheRoot, "*.body")
                    .Select(path => new FileInfo(path))
                    .Where(info => info.Exists)
                    .OrderBy(info => info.LastWriteTimeUtc)
                    .ToList();

                var total = files.Sum(info => info.Length);
                if (total <= MaxCacheBytes) return;

                foreach (var info in files)
                {
                    if (total <= MaxCacheBytes * 8 / 10) break;

                    total -= info.Length;
                    var key = Path.GetFileNameWithoutExtension(info.Name);
                    TryDelete(info.FullName);
                    TryDelete(Path.Combine(_cacheRoot, key + ".meta.json"));
                }
            }
            catch
            {
                // Best effort.
            }
        });
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); } catch { }
    }

    private static string KeyFor(Uri uri)
    {
        var normalized = uri.GetComponents(UriComponents.HttpRequestUrl, UriFormat.UriEscaped);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static string GuessContentType(string path)
    {
        var extension = Path.GetExtension(path).ToLowerInvariant();
        return extension switch
        {
            ".html" or ".htm" => "text/html; charset=utf-8",
            ".js" or ".mjs" => "text/javascript; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            ".svg" => "image/svg+xml",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".ico" => "image/x-icon",
            ".woff2" => "font/woff2",
            ".woff" => "font/woff",
            ".ttf" => "font/ttf",
            ".md" => "text/markdown; charset=utf-8",
            ".txt" => "text/plain; charset=utf-8",
            ".xml" => "application/xml; charset=utf-8",
            ".map" => "application/json; charset=utf-8",
            ".wasm" => "application/wasm",
            _ => "application/octet-stream",
        };
    }

    private readonly record struct FetchOutcome(CachedResponse? Response, int StatusCode);

    private sealed class CacheMeta
    {
        public string Url { get; set; } = "";
        public string? ContentType { get; set; }
        public int StatusCode { get; set; } = 200;
        public Dictionary<string, string> Headers { get; set; } = new();
        public DateTime SavedAtUtc { get; set; }
    }
}
