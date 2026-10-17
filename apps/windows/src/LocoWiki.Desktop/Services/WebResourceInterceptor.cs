using System.IO;
using System.Text;
using Microsoft.Web.WebView2.Core;

namespace LocoWiki.Desktop.Services;

/// <summary>
/// Routes requests for the wiki origins through <see cref="SiteCache"/> so that
/// online-first loading transparently degrades to the disk cache or the bundled
/// snapshot when the network is unavailable.
/// </summary>
public sealed class WebResourceInterceptor : IDisposable
{
    private static readonly string[] SiteHosts = { "locowiki.com", "www.locowiki.com", "locowiki.github.io" };

    private readonly CoreWebView2 _webView;
    private readonly CoreWebView2Environment _environment;
    private readonly SiteCache _cache;
    private bool _attached;

    public WebResourceInterceptor(CoreWebView2 webView, CoreWebView2Environment environment, SiteCache cache)
    {
        _webView = webView;
        _environment = environment;
        _cache = cache;
    }

    public static bool IsSiteHost(string host) =>
        SiteHosts.Contains(host, StringComparer.OrdinalIgnoreCase);

    public void Attach()
    {
        if (_attached) return;

        foreach (var host in SiteHosts)
        {
            _webView.AddWebResourceRequestedFilter(
                $"https://{host}/*",
                CoreWebView2WebResourceContext.All);
        }

        _webView.AddWebResourceRequestedFilter(
            "https://raw.githubusercontent.com/LocoWiki/*",
            CoreWebView2WebResourceContext.All);

        _webView.WebResourceRequested += OnWebResourceRequested;
        _attached = true;
    }

    private async void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var deferral = e.GetDeferral();
        try
        {
            if (!TryNormalize(e.Request, out var uri)) return;

            var response = await _cache.ResolveAsync(uri);
            if (response is null) return;

            var headers = BuildHeaders(response);
            var stream = new MemoryStream(response.Body, writable: false);
            e.Response = _environment.CreateWebResourceResponse(
                stream,
                response.StatusCode,
                "OK",
                headers);
        }
        catch
        {
            // Fall through to WebView2's own network stack.
        }
        finally
        {
            deferral.Complete();
        }
    }

    private static bool TryNormalize(CoreWebView2WebResourceRequest request, out Uri uri)
    {
        uri = null!;

        if (!string.Equals(request.Method, "GET", StringComparison.OrdinalIgnoreCase)) return false;
        if (request.Headers.Contains("Range")) return false;
        if (!Uri.TryCreate(request.Uri, UriKind.Absolute, out var parsed)) return false;
        if (!string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) return false;

        if (string.Equals(parsed.Host, "raw.githubusercontent.com", StringComparison.OrdinalIgnoreCase))
        {
            if (!parsed.AbsolutePath.StartsWith("/LocoWiki/", StringComparison.OrdinalIgnoreCase)) return false;
        }
        else if (!IsSiteHost(parsed.Host))
        {
            return false;
        }

        uri = parsed;
        return true;
    }

    private static string BuildHeaders(CachedResponse response)
    {
        var builder = new StringBuilder();
        builder.Append("Content-Type: ").Append(response.ContentType).Append("\r\n");
        builder.Append("Cache-Control: no-store\r\n");
        builder.Append("Access-Control-Allow-Origin: *\r\n");
        builder.Append("X-LocoWiki-Source: ").Append(response.Source).Append("\r\n");

        if (response.Headers is not null)
        {
            foreach (var (name, value) in response.Headers)
            {
                if (string.Equals(name, "Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
                if (string.Equals(name, "Content-Length", StringComparison.OrdinalIgnoreCase)) continue;
                if (string.IsNullOrWhiteSpace(value)) continue;
                builder.Append(name).Append(": ").Append(value).Append("\r\n");
            }
        }

        return builder.ToString();
    }

    public void Dispose()
    {
        if (!_attached) return;

        _webView.WebResourceRequested -= OnWebResourceRequested;
        _attached = false;
    }
}
