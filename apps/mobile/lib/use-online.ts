import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useEffect, useState } from "react";

function isOnline(state: Network.NetworkState): boolean {
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

/**
 * Connectivity for the offline Snackbar and the health check. Also feeds TanStack Query's
 * onlineManager so cached queries refetch automatically on reconnect (FR-115).
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    void Network.getNetworkStateAsync().then((s) => {
      if (!mounted) return;
      setOnline(isOnline(s));
      onlineManager.setOnline(isOnline(s));
    });
    const sub = Network.addNetworkStateListener((s) => {
      setOnline(isOnline(s));
      onlineManager.setOnline(isOnline(s));
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return online;
}
