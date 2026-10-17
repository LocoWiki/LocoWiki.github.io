using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using LocoWiki.Desktop.Services;
using Microsoft.Web.WebView2.Core;

namespace LocoWiki.Desktop;

public partial class MainWindow : Window
{
    private const string HomeUrl = "https://locowiki.com/";
    private const string FallbackUrl = "https://locowiki.github.io/";

    private static readonly SolidColorBrush OnlineBrush = new(Color.FromRgb(0x4A, 0xDE, 0x80));
    private static readonly SolidColorBrush OfflineBrush = new(Color.FromRgb(0xF5, 0xA5, 0x24));

    private readonly NetworkGate _network = new();
    private readonly DispatcherTimer _statusTimer = new() { Interval = TimeSpan.FromSeconds(5) };

    private readonly string _startUrl = ResolveStartUrl();

    private SiteCache? _cache;
    private WebResourceInterceptor? _interceptor;
    private CoreWebView2Environment? _environment;
    private bool _initialized;
    private bool _showingError;

    public MainWindow()
    {
        InitializeComponent();

        // Keep the status bar on screen on scaled 1080p displays.
        var workArea = SystemParameters.WorkArea;
        Width = Math.Min(Width, Math.Max(MinWidth, workArea.Width - 48));
        Height = Math.Min(Height, Math.Max(MinHeight, workArea.Height - 48));

        Loaded += OnLoaded;
        Closing += OnClosing;
        _statusTimer.Tick += (_, _) => UpdateStatus();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (_initialized) return;
        _initialized = true;

        if (Environment.GetEnvironmentVariable("LOCOWIKI_FORCE_OFFLINE") == "1")
        {
            _network.ForceOffline();
        }

        try
        {
            var appData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "LocoWiki");
            var userDataFolder = Path.Combine(appData, "WebView2");
            var cacheFolder = Path.Combine(appData, "WebCache");
            Directory.CreateDirectory(userDataFolder);
            Directory.CreateDirectory(cacheFolder);

            var options = new CoreWebView2EnvironmentOptions("--disable-features=msWebOOUI,msPdfOOUI");
            _environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
            await WebView.EnsureCoreWebView2Async(_environment);

            var core = WebView.CoreWebView2;
            ConfigureSettings(core);

            var bundleFolder = Path.Combine(AppContext.BaseDirectory, "offline-site");
            _cache = new SiteCache(cacheFolder, bundleFolder, _network);
            _interceptor = new WebResourceInterceptor(core, _environment, _cache);
            _interceptor.Attach();

            core.NewWindowRequested += OnNewWindowRequested;
            core.NavigationStarting += OnNavigationStarting;
            core.NavigationCompleted += OnNavigationCompleted;
            core.DocumentTitleChanged += OnDocumentTitleChanged;
            core.WebMessageReceived += OnWebMessageReceived;
            core.ProcessFailed += OnProcessFailed;

            _statusTimer.Start();
            UpdateStatus();
            NavigateHome();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            ShowFatal(
                "未检测到 WebView2 运行时",
                "LocoWiki 需要 Microsoft Edge WebView2 Runtime。\n\n请安装后重新启动：" +
                "\nhttps://developer.microsoft.com/microsoft-edge/webview2/");
        }
        catch (Exception ex)
        {
            ShowFatal("无法启动 LocoWiki", ex.Message);
        }
    }

    private static void ConfigureSettings(CoreWebView2 core)
    {
        var settings = core.Settings;
        settings.IsStatusBarEnabled = false;
        settings.AreDevToolsEnabled = true;
        settings.AreDefaultContextMenusEnabled = true;
        settings.IsZoomControlEnabled = true;
        settings.IsSwipeNavigationEnabled = false;
        settings.IsPasswordAutosaveEnabled = false;
        settings.IsGeneralAutofillEnabled = false;
    }

    private void NavigateHome()
    {
        if (WebView.CoreWebView2 is null) return;

        _showingError = false;
        Splash.Visibility = Visibility.Visible;
        SplashText.Text = "正在连接 locowiki.com…";
        WebView.CoreWebView2.Navigate(_startUrl);
    }

    private static string ResolveStartUrl()
    {
        var arguments = Environment.GetCommandLineArgs();
        if (arguments.Length > 1
            && Uri.TryCreate(arguments[1], UriKind.Absolute, out var uri)
            && uri.Scheme is "http" or "https"
            && WebResourceInterceptor.IsSiteHost(uri.Host))
        {
            return uri.AbsoluteUri;
        }

        return HomeUrl;
    }

    private void NavigateFallback()
    {
        if (WebView.CoreWebView2 is null) return;

        _showingError = false;
        Splash.Visibility = Visibility.Visible;
        SplashText.Text = "正在连接 locowiki.github.io…";
        WebView.CoreWebView2.Navigate(FallbackUrl);
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri)) return;

        if (uri.Scheme is "http" or "https" && !WebResourceInterceptor.IsSiteHost(uri.Host))
        {
            e.Cancel = true;
            OpenExternal(uri);
            return;
        }

        if (uri.Scheme is not ("http" or "https" or "about")) return;

        _showingError = false;
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        Splash.Visibility = Visibility.Collapsed;

        if (!e.IsSuccess)
        {
            if (!_showingError) ShowOfflinePage(e.WebErrorStatus.ToString());
            return;
        }

        UpdateStatus();
    }

    private void ShowOfflinePage(string? detail)
    {
        _showingError = true;
        var html = OfflinePageTemplate.Replace(
            "{{DETAIL}}",
            WebUtility.HtmlEncode(detail ?? string.Empty),
            StringComparison.Ordinal);

        WebView.NavigateToString(html);
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string? message;
        try
        {
            message = e.TryGetWebMessageAsString();
        }
        catch
        {
            return;
        }

        switch (message)
        {
            case "retry":
                _network.ForceRetry();
                NavigateHome();
                break;
            case "fallback":
                _network.ForceRetry();
                NavigateFallback();
                break;
            case "open-web":
                OpenExternal(new Uri(HomeUrl));
                break;
        }
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri)) OpenExternal(uri);
    }

    private void OnDocumentTitleChanged(object? sender, object e)
    {
        var title = WebView.CoreWebView2?.DocumentTitle;
        Title = string.IsNullOrWhiteSpace(title) ? "LocoWiki" : title;
    }

    private void OnProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        if (e.ProcessFailedKind is CoreWebView2ProcessFailedKind.BrowserProcessExited)
        {
            StatusText.Text = "浏览器进程已退出";
            StatusDot.Fill = OfflineBrush;
            return;
        }

        if (e.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited)
        {
            WebView.CoreWebView2?.Reload();
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var isReload = e.Key == Key.F5
                       || (e.Key == Key.R && Keyboard.Modifiers.HasFlag(ModifierKeys.Control));

        if (!isReload) return;

        e.Handled = true;
        OnRefreshClick(this, new RoutedEventArgs());
    }

    private void OnRefreshClick(object sender, RoutedEventArgs e)
    {
        if (WebView.CoreWebView2 is null) return;

        _network.ForceRetry();
        _showingError = false;

        if (WebView.Source is null || WebView.Source.AbsoluteUri.StartsWith("about:", StringComparison.OrdinalIgnoreCase))
        {
            NavigateHome();
            return;
        }

        WebView.CoreWebView2.Reload();
        UpdateStatus();
    }

    private void UpdateStatus()
    {
        if (_cache is null) return;

        var online = _cache.IsOnline;
        StatusText.Text = online ? "在线 · 网络优先" : "离线 · 使用本地缓存";
        StatusDot.Fill = online ? OnlineBrush : OfflineBrush;
        CacheText.Text = $"缓存 {FormatBytes(_cache.GetCacheSizeBytes())}";
    }

    private void OpenExternal(Uri uri)
    {
        if (uri.Scheme is not ("http" or "https")) return;

        try
        {
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        }
        catch
        {
            // Ignore shell failures.
        }
    }

    private static string FormatBytes(long bytes)
    {
        string[] units = { "B", "KB", "MB", "GB" };
        double value = bytes;
        var unit = 0;
        while (value >= 1024 && unit < units.Length - 1)
        {
            value /= 1024;
            unit++;
        }

        return unit == 0 ? $"{bytes} B" : $"{value:0.0} {units[unit]}";
    }

    private void ShowFatal(string title, string message)
    {
        MessageBox.Show(this, message, title, MessageBoxButton.OK, MessageBoxImage.Error);
        Close();
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);

        try
        {
            var handle = new WindowInteropHelper(this).Handle;
            var enabled = 1;
            DwmSetWindowAttribute(handle, 20, ref enabled, sizeof(int));
        }
        catch
        {
            // Dark title bar is cosmetic; ignore on older Windows versions.
        }
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _statusTimer.Stop();
        _interceptor?.Dispose();

        try
        {
            WebView.Dispose();
        }
        catch
        {
            // Best effort during shutdown.
        }
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    private const string OfflinePageTemplate = """
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
    background: #0f1115; color: #e8edf5;
    font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  }
  .card { width: min(520px, calc(100vw - 48px)); text-align: center; }
  .logo { font-size: 34px; font-weight: 700; letter-spacing: .5px; }
  .tagline { margin-top: 8px; color: #8b93a7; font-size: 13px; }
  h1 { margin: 30px 0 10px; font-size: 18px; font-weight: 600; }
  p { margin: 0; color: #9aa3b6; font-size: 13px; line-height: 1.7; }
  code { color: #6fb6ff; font-size: 12px; }
  .actions { margin-top: 26px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  button {
    appearance: none; border: 1px solid #2e3646; border-radius: 8px;
    padding: 9px 18px; font-size: 13px; cursor: pointer;
    background: #1e2430; color: #e8edf5;
  }
  button.primary { background: #2f6fce; border-color: #3f80e0; }
  button:hover { filter: brightness(1.12); }
  .hint { margin-top: 18px; font-size: 12px; color: #6d7688; }
</style>
</head>
<body>
  <main class="card">
    <div class="logo">LocoWiki</div>
    <div class="tagline">机器人知识库 · 桌面客户端</div>
    <h1>当前无法连接到 locowiki.com</h1>
    <p>请检查网络连接。已浏览过的页面会自动保存在本机，<br />恢复网络后可直接刷新继续阅读。</p>
    <p class="hint">错误信息：<code>{{DETAIL}}</code></p>
    <div class="actions">
      <button class="primary" onclick="send('retry')">重试</button>
      <button onclick="send('fallback')">切换到 GitHub Pages</button>
      <button onclick="send('open-web')">在浏览器中打开</button>
    </div>
  </main>
  <script>
    function send(action) {
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(action);
      } else {
        window.location.href = "https://locowiki.com/";
      }
    }
  </script>
</body>
</html>
""";
}
