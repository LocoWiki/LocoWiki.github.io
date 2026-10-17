using System.IO;

namespace LocoWiki.Desktop.Services;

/// <summary>
/// Minimal file logger. Never throws: diagnostics must not affect browsing.
/// </summary>
internal static class Diagnostics
{
    private static readonly object Sync = new();

    public static string LogDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "LocoWiki",
        "logs");

    public static void Log(string message)
    {
        try
        {
            Directory.CreateDirectory(LogDirectory);
            lock (Sync)
            {
                File.AppendAllText(
                    Path.Combine(LogDirectory, "app.log"),
                    $"[{DateTimeOffset.Now:O}] {message}{Environment.NewLine}");
            }
        }
        catch
        {
            // Best effort only.
        }
    }
}
