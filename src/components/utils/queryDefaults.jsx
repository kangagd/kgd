/**
 * Default React Query configuration
 * Optimized to reduce polling, prevent flakiness, and improve mobile performance
 */

export const defaultQueryOpts = {
  staleTime: 60000, // 1 minute - data is fresh for this long
  refetchOnWindowFocus: false, // Don't refetch when user returns to tab
  refetchOnReconnect: false, // Don't refetch when network reconnects
  retry: (count, err) => err?.status !== 429 && count < 2, // Retry failed requests (except rate limits)
};

/**
 * For data that needs real-time updates (e.g., Inbox)
 * Use sparingly - only where users expect live data
 */
export const realtimeQueryOpts = {
  ...defaultQueryOpts,
  staleTime: 30000, // 30 seconds
  refetchInterval: 30000, // Poll every 30s
};

/**
 * For reference data that rarely changes (e.g., suppliers, vehicles, price list)
 */
export const referenceDataOpts = {
  ...defaultQueryOpts,
  staleTime: 300000, // 5 minutes
};