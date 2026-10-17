package com.locowiki.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {

    private static final String HOME_URL = "https://locowiki.com/";
    private static final String USER_AGENT_SUFFIX = "LocoWikiAndroid/0.1";

    private WebView webView;
    private View splash;
    private SiteCache siteCache;
    private NetworkGate networkGate;
    private boolean showingError;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        FrameLayout root = findViewById(R.id.root);
        webView = findViewById(R.id.web_view);
        splash = findViewById(R.id.splash);

        networkGate = new NetworkGate(this);
        siteCache = new SiteCache(this, networkGate);

        configureEdgeToEdge(root);
        configureWebView(webView);
        configureClients(webView);

        webView.loadUrl(HOME_URL);
    }

    private void configureEdgeToEdge(FrameLayout root) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);

            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                        0,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }

            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " " + USER_AGENT_SUFFIX);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        view.setBackgroundColor(getColor(R.color.app_background));
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true);
    }

    private void configureClients(WebView view) {
        view.setWebChromeClient(new WebChromeClient());

        view.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url != null) {
                openExternal(Uri.parse(url));
            }
        });

        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView webView, WebResourceRequest request) {
                if (request.getMethod() != null && !"GET".equalsIgnoreCase(request.getMethod())) {
                    return null;
                }

                Uri uri = request.getUrl();
                if (!SiteCache.isCacheable(uri)) {
                    return null;
                }

                try {
                    return siteCache.resolve(uri);
                } catch (RuntimeException e) {
                    return null;
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                if (!request.isForMainFrame()) {
                    return false;
                }

                Uri uri = request.getUrl();
                if (uri == null) {
                    return false;
                }

                if (SiteCache.isSiteHost(uri.getHost())) {
                    if (uri.getQueryParameter("loco_retry") != null) {
                        networkGate.reset();
                    }
                    return false;
                }

                openExternal(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView webView, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(webView, url, favicon);
                if (url != null && url.startsWith("http")) {
                    showingError = false;
                }
            }

            @Override
            public void onPageFinished(WebView webView, String url) {
                super.onPageFinished(webView, url);
                if (!showingError) {
                    hideSplash();
                }
            }

            @Override
            public void onReceivedError(WebView webView, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(webView, request, error);
                if (request.isForMainFrame()) {
                    showErrorPage();
                }
            }
        });
    }

    private void showErrorPage() {
        if (showingError || webView == null) {
            return;
        }

        showingError = true;
        hideSplash();
        webView.loadDataWithBaseURL(HOME_URL, ERROR_PAGE, "text/html", "utf-8", null);
    }

    private void hideSplash() {
        if (splash == null || splash.getVisibility() != View.VISIBLE) {
            return;
        }

        splash.animate()
                .alpha(0f)
                .setDuration(180)
                .withEndAction(() -> splash.setVisibility(View.GONE))
                .start();
    }

    private void openExternal(Uri uri) {
        if (uri == null || uri.getScheme() == null) {
            return;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // No handler installed; ignore.
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private static final String ERROR_PAGE = """
            <!doctype html>
            <html lang="zh-CN">
            <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>LocoWiki · 离线</title>
            <style>
              :root { color-scheme: dark; }
              * { box-sizing: border-box; }
              body {
                margin: 0; min-height: 100vh; display: grid; place-items: center;
                background: #0f1115; color: #e8edf5; padding: 24px;
                font-family: system-ui, "Noto Sans SC", "Microsoft YaHei", sans-serif;
              }
              .card { width: min(520px, 100%); text-align: center; }
              .logo { font-size: 32px; font-weight: 700; }
              .tagline { margin-top: 8px; color: #8b93a7; font-size: 12px; }
              h1 { margin: 30px 0 10px; font-size: 18px; font-weight: 600; }
              p { margin: 0; color: #9aa3b6; font-size: 13px; line-height: 1.7; }
              .actions { margin-top: 26px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
              a {
                display: inline-block; text-decoration: none; border-radius: 9px;
                padding: 11px 18px; font-size: 13px;
                background: #1e2430; color: #e8edf5; border: 1px solid #2e3646;
              }
              a.primary { background: #2f6fce; border-color: #3f80e0; }
              .hint { margin-top: 18px; font-size: 12px; color: #6d7688; }
            </style>
            </head>
            <body>
              <main class="card">
                <div class="logo">LocoWiki</div>
                <div class="tagline">机器人知识库 · Android 客户端</div>
                <h1>当前无法连接到 locowiki.com</h1>
                <p>请检查网络连接。已浏览过的页面会自动保存在本机，<br />恢复网络后可直接刷新继续阅读。</p>
                <div class="actions">
                  <a class="primary" href="https://locowiki.com/?loco_retry=1">重试</a>
                  <a href="https://locowiki.github.io/">切换到 GitHub Pages</a>
                </div>
                <p class="hint">离线缓存仅保存在本机，不会上传任何数据。</p>
              </main>
            </body>
            </html>
            """;
}
