package com.locowiki.app;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Network-first resource store for the wiki origins.
 *
 * <p>Every request is routed through {@link #resolve(Uri)}: fetch from the
 * network, persist a copy on success, and fall back to the disk copy (or the
 * bundled asset snapshot) when the network is unavailable.
 */
final class SiteCache {

    private static final String[] SITE_HOSTS = {
            "locowiki.com",
            "www.locowiki.com",
            "locowiki.github.io",
    };

    private static final int TIMEOUT_MS = 7_000;
    private static final long MAX_CACHEABLE_BYTES = 16L * 1024 * 1024;
    private static final long MAX_CACHE_BYTES = 256L * 1024 * 1024;
    private static final String USER_AGENT = "LocoWikiAndroid/0.1 (+https://locowiki.com)";

    private final Context context;
    private final File cacheDir;
    private final NetworkGate networkGate;

    SiteCache(Context context, NetworkGate networkGate) {
        this.context = context.getApplicationContext();
        this.networkGate = networkGate;
        this.cacheDir = new File(this.context.getCacheDir(), "webcache");
        //noinspection ResultOfMethodCallIgnored
        this.cacheDir.mkdirs();

        Thread pruner = new Thread(this::pruneCache, "locowiki-cache-prune");
        pruner.setDaemon(true);
        pruner.start();
    }

    private void pruneCache() {
        try {
            File[] files = cacheDir.listFiles((directory, name) -> name.endsWith(".bin"));
            if (files == null) {
                return;
            }

            long total = 0L;
            for (File file : files) {
                total += file.length();
            }

            if (total <= MAX_CACHE_BYTES) {
                return;
            }

            java.util.Arrays.sort(files, (left, right) -> Long.compare(left.lastModified(), right.lastModified()));
            for (File file : files) {
                if (total <= MAX_CACHE_BYTES * 8 / 10) {
                    break;
                }

                total -= file.length();
                String key = file.getName().substring(0, file.getName().length() - ".bin".length());
                //noinspection ResultOfMethodCallIgnored
                file.delete();
                //noinspection ResultOfMethodCallIgnored
                new File(cacheDir, key + ".type").delete();
            }
        } catch (RuntimeException ignored) {
            // Cache pruning is best effort.
        }
    }

    static boolean isSiteHost(String host) {
        if (host == null) {
            return false;
        }

        for (String siteHost : SITE_HOSTS) {
            if (siteHost.equalsIgnoreCase(host)) {
                return true;
            }
        }

        return false;
    }

    static boolean isCacheable(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) {
            return false;
        }

        String host = uri.getHost();
        if ("raw.githubusercontent.com".equalsIgnoreCase(host)) {
            String path = uri.getPath();
            return path != null && path.toLowerCase(Locale.ROOT).startsWith("/locowiki/");
        }

        return isSiteHost(host);
    }

    WebResourceResponse resolve(Uri uri) {
        Data data = null;
        String source = "cache";

        if (networkGate.isOnline()) {
            FetchResult result = fetch(uri);

            // locowiki.com may miss a page that GitHub Pages already has
            // (for example papers.html). Try the mirror before serving stale data.
            if (result.data == null && result.status == 404 && isPrimaryHost(uri.getHost())) {
                FetchResult mirror = fetch(withMirrorHost(uri));
                if (mirror.data != null) {
                    android.util.Log.i("LocoWikiCache", "mirror fallback: " + uri);
                    result = mirror;
                }
            }

            data = result.data;
            if (data != null) {
                source = "network";
                networkGate.markSuccess();
                save(uri, data);
            } else {
                networkGate.markFailure();
            }
        }

        if (data == null) {
            data = readCache(uri);
            source = "cache";
        }

        if (data == null && isSiteHost(uri.getHost())) {
            data = readAsset(uri);
            source = "bundle";
        }

        if (data == null) {
            android.util.Log.w("LocoWikiCache", "unavailable: " + uri);
            return null;
        }

        if (!"network".equals(source)) {
            android.util.Log.i("LocoWikiCache", "offline fallback (" + source + "): " + uri);
        }

        return buildResponse(uri, data, source);
    }

    private static boolean isPrimaryHost(String host) {
        return "locowiki.com".equalsIgnoreCase(host) || "www.locowiki.com".equalsIgnoreCase(host);
    }

    private static Uri withMirrorHost(Uri uri) {
        return uri.buildUpon().authority("locowiki.github.io").build();
    }

    private FetchResult fetch(Uri uri) {
        HttpURLConnection connection = null;

        try {
            connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("User-Agent", USER_AGENT);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
            connection.setRequestProperty("Accept", "*/*");

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                return new FetchResult(null, status);
            }

            long declaredLength = connection.getContentLengthLong();
            if (declaredLength > MAX_CACHEABLE_BYTES) {
                return new FetchResult(null, status);
            }

            Data data = new Data();
            try (InputStream stream = connection.getInputStream()) {
                data.body = readAll(stream, MAX_CACHEABLE_BYTES);
            }
            data.contentType = connection.getContentType();
            return new FetchResult(data, status);
        } catch (Exception e) {
            return new FetchResult(null, 0);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void save(Uri uri, Data data) {
        if (data.body == null || data.body.length == 0 || data.body.length > MAX_CACHEABLE_BYTES) {
            return;
        }

        String key = cacheKey(uri);
        File bodyFile = new File(cacheDir, key + ".bin");
        File bodyTemp = new File(cacheDir, key + "." + System.nanoTime() + ".tmp");
        File typeFile = new File(cacheDir, key + ".type");

        try {
            try (FileOutputStream output = new FileOutputStream(bodyTemp)) {
                output.write(data.body);
            }

            if (!bodyTemp.renameTo(bodyFile)) {
                //noinspection ResultOfMethodCallIgnored
                bodyFile.delete();
                if (!bodyTemp.renameTo(bodyFile)) {
                    //noinspection ResultOfMethodCallIgnored
                    bodyTemp.delete();
                    return;
                }
            }

            String contentType = data.contentType == null ? "" : data.contentType;
            try (FileOutputStream output = new FileOutputStream(typeFile)) {
                output.write(contentType.getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException ignored) {
            // A cache write must never break browsing.
        }
    }

    private Data readCache(Uri uri) {
        String key = cacheKey(uri);
        File bodyFile = new File(cacheDir, key + ".bin");
        if (!bodyFile.isFile() || bodyFile.length() > MAX_CACHEABLE_BYTES) {
            return null;
        }

        try {
            Data data = new Data();
            try (InputStream input = new FileInputStream(bodyFile)) {
                data.body = readAll(input, MAX_CACHEABLE_BYTES);
            }

            File typeFile = new File(cacheDir, key + ".type");
            if (typeFile.isFile()) {
                try (InputStream input = new FileInputStream(typeFile)) {
                    data.contentType = new String(readAll(input, 4096), StandardCharsets.UTF_8).trim();
                }
            }

            //noinspection ResultOfMethodCallIgnored
            bodyFile.setLastModified(System.currentTimeMillis());
            return data;
        } catch (IOException e) {
            return null;
        }
    }

    private Data readAsset(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            path = "/index.html";
        }
        if (path.endsWith("/")) {
            path += "index.html";
        }

        String decoded = Uri.decode(path);
        if (decoded.contains("..")) {
            return null;
        }

        try (InputStream input = context.getAssets().open("offline-site" + decoded)) {
            Data data = new Data();
            data.body = readAll(input, MAX_CACHEABLE_BYTES);
            data.contentType = guessContentType(decoded);
            return data;
        } catch (IOException e) {
            return null;
        }
    }

    private WebResourceResponse buildResponse(Uri uri, Data data, String source) {
        String contentType = data.contentType;
        if (contentType == null || contentType.isEmpty()) {
            contentType = guessContentType(uri.getPath());
        }

        String mimeType = contentType;
        String charset = null;

        int semicolon = contentType.indexOf(';');
        if (semicolon >= 0) {
            mimeType = contentType.substring(0, semicolon).trim();
            String parameters = contentType.substring(semicolon + 1);
            for (String parameter : parameters.split(";")) {
                String trimmed = parameter.trim();
                if (trimmed.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                    charset = trimmed.substring("charset=".length()).trim().replace("\"", "");
                }
            }
        }

        if (charset == null && isTextual(mimeType)) {
            charset = "utf-8";
        }

        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("X-LocoWiki-Source", source);

        return new WebResourceResponse(
                mimeType,
                charset,
                200,
                "OK",
                headers,
                new ByteArrayInputStream(data.body));
    }

    private static boolean isTextual(String mimeType) {
        String type = mimeType.toLowerCase(Locale.ROOT);
        return type.startsWith("text/")
                || type.contains("json")
                || type.contains("javascript")
                || type.contains("xml")
                || type.contains("svg");
    }

    private static String cacheKey(Uri uri) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(uri.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte value : hash) {
                builder.append(Character.forDigit((value >> 4) & 0xF, 16));
                builder.append(Character.forDigit(value & 0xF, 16));
            }
            return builder.toString();
        } catch (Exception e) {
            return Integer.toHexString(uri.toString().hashCode());
        }
    }

    private static byte[] readAll(InputStream input, long limit) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long total = 0;
        int read;

        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > limit) {
                throw new IOException("Response body exceeds limit");
            }
            output.write(buffer, 0, read);
        }

        return output.toByteArray();
    }

    static String guessContentType(String path) {
        String value = path == null ? "" : path.toLowerCase(Locale.ROOT);

        if (value.endsWith(".html") || value.endsWith(".htm")) return "text/html; charset=utf-8";
        if (value.endsWith(".js") || value.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (value.endsWith(".css")) return "text/css; charset=utf-8";
        if (value.endsWith(".json")) return "application/json; charset=utf-8";
        if (value.endsWith(".svg")) return "image/svg+xml";
        if (value.endsWith(".png")) return "image/png";
        if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
        if (value.endsWith(".webp")) return "image/webp";
        if (value.endsWith(".gif")) return "image/gif";
        if (value.endsWith(".ico")) return "image/x-icon";
        if (value.endsWith(".woff2")) return "font/woff2";
        if (value.endsWith(".woff")) return "font/woff";
        if (value.endsWith(".ttf")) return "font/ttf";
        if (value.endsWith(".md")) return "text/markdown; charset=utf-8";
        if (value.endsWith(".txt")) return "text/plain; charset=utf-8";
        if (value.endsWith(".xml")) return "application/xml; charset=utf-8";
        if (value.endsWith(".wasm")) return "application/wasm";

        return "application/octet-stream";
    }

    private static final class Data {
        byte[] body;
        String contentType;
    }

    private static final class FetchResult {
        final Data data;
        final int status;

        FetchResult(Data data, int status) {
            this.data = data;
            this.status = status;
        }
    }
}
