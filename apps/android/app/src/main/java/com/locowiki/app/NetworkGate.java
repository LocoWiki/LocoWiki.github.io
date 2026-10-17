package com.locowiki.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

/**
 * Small circuit breaker: when a request fails we stop hammering the network for
 * a few seconds so that an offline page with dozens of assets fails fast instead
 * of waiting for a timeout on every resource.
 */
final class NetworkGate {

    private static final long OFFLINE_BACKOFF_MS = 20_000L;

    private final ConnectivityManager connectivityManager;
    private long retryAfterMs;

    NetworkGate(Context context) {
        connectivityManager = (ConnectivityManager) context
                .getApplicationContext()
                .getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    synchronized boolean isOnline() {
        if (System.currentTimeMillis() < retryAfterMs) {
            return false;
        }

        if (connectivityManager == null) {
            return false;
        }

        try {
            Network network = connectivityManager.getActiveNetwork();
            if (network == null) {
                return false;
            }

            NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);
            return capabilities != null
                    && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (RuntimeException e) {
            return false;
        }
    }

    synchronized void markFailure() {
        retryAfterMs = System.currentTimeMillis() + OFFLINE_BACKOFF_MS;
    }

    synchronized void markSuccess() {
        retryAfterMs = 0L;
    }

    synchronized void reset() {
        retryAfterMs = 0L;
    }
}
