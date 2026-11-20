import { useCallback, useEffect, useState } from 'react';
import { AgriHubApi, hasConfiguredBackend } from '../api';

export interface NetworkStatusState {
  isNavigatorOnline: boolean;
  isBackendReachable: boolean;
  isOnline: boolean;
  checking: boolean;
  lastCheckedAt: string | null;
  statusMessage: string;
  recheckConnectivity: () => Promise<boolean>;
}

export function useNetworkStatus(pollIntervalMs = 30000): NetworkStatusState {
  const [isNavigatorOnline, setIsNavigatorOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isBackendReachable, setIsBackendReachable] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Checking connectivity...');

  const recheckConnectivity = useCallback(async (): Promise<boolean> => {
    const navOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsNavigatorOnline(navOnline);

    if (!navOnline) {
      setIsBackendReachable(false);
      setStatusMessage('Offline — Browser has no network connection.');
      setLastCheckedAt(new Date().toISOString());
      return false;
    }

    if (!hasConfiguredBackend()) {
      setIsBackendReachable(false);
      setStatusMessage('Offline-First Sandbox (Local IndexedDB Cache Active)');
      setLastCheckedAt(new Date().toISOString());
      return false;
    }

    setChecking(true);
    try {
      const res = await AgriHubApi.checkConnection();
      setIsBackendReachable(res.connected);
      setStatusMessage(res.message);
      setLastCheckedAt(new Date().toISOString());
      return res.connected;
    } catch {
      setIsBackendReachable(false);
      setStatusMessage('Backend API unreachable — changes queued locally.');
      setLastCheckedAt(new Date().toISOString());
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    recheckConnectivity();

    const onOnline = () => {
      setIsNavigatorOnline(true);
      recheckConnectivity();
    };
    const onOffline = () => {
      setIsNavigatorOnline(false);
      setIsBackendReachable(false);
      setStatusMessage('Offline — Saving all changes to IndexedDB.');
      setLastCheckedAt(new Date().toISOString());
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const timer = window.setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        recheckConnectivity();
      }
    }, pollIntervalMs);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(timer);
    };
  }, [pollIntervalMs, recheckConnectivity]);

  return {
    isNavigatorOnline,
    isBackendReachable,
    isOnline: isNavigatorOnline && isBackendReachable,
    checking,
    lastCheckedAt,
    statusMessage,
    recheckConnectivity
  };
}
