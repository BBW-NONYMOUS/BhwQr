import { QueryClient } from "@tanstack/react-query";

/**
 * One QueryClient for the app. Attendance data is server-truth (server time, server validation),
 * so queries refetch on reconnect; scans are mutations and are never retried automatically
 * (a retried scan could reuse a QR nonce - see development.md "never queue scans offline").
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 2, refetchOnReconnect: true },
      mutations: { retry: 0 },
    },
  });
}
