using System.Net.NetworkInformation;

namespace LocoWiki.Desktop.Services;

/// <summary>
/// Small circuit breaker around the network. When a request fails we assume the
/// machine is offline for a short while so that a page with dozens of assets does
/// not wait for a timeout on every single resource.
/// </summary>
public sealed class NetworkGate
{
    private static readonly TimeSpan OfflineBackoff = TimeSpan.FromSeconds(20);
    private readonly object _sync = new();
    private DateTime _retryAfterUtc = DateTime.MinValue;
    private bool _forcedOffline;
    private bool _lastAvailability;
    private DateTime _lastAvailabilityCheckUtc = DateTime.MinValue;

    public bool IsOnline
    {
        get
        {
            var now = DateTime.UtcNow;
            if (now - _lastAvailabilityCheckUtc > TimeSpan.FromSeconds(3))
            {
                _lastAvailability = NetworkInterface.GetIsNetworkAvailable();
                _lastAvailabilityCheckUtc = now;
            }

            if (!_lastAvailability) return false;

            lock (_sync)
            {
                return !_forcedOffline && now >= _retryAfterUtc;
            }
        }
    }

    public void MarkFailure()
    {
        lock (_sync)
        {
            _retryAfterUtc = DateTime.UtcNow.Add(OfflineBackoff);
        }
    }

    public void MarkSuccess()
    {
        lock (_sync)
        {
            _retryAfterUtc = DateTime.MinValue;
        }
    }

    public void ForceRetry()
    {
        lock (_sync)
        {
            _retryAfterUtc = DateTime.MinValue;
            _forcedOffline = false;
        }

        _lastAvailabilityCheckUtc = DateTime.MinValue;
    }

    public void ForceOffline()
    {
        lock (_sync)
        {
            _forcedOffline = true;
        }
    }
}
