/**
 * Invalidate Once - Prevents duplicate invalidations within a cooldown period
 * 
 * Usage:
 * invalidateOnce(queryClient, queryKey, cooldownMs)
 * 
 * Use this instead of queryClient.invalidateQueries() when you have multiple
 * event sources that could trigger the same invalidation (e.g., subscriptions,
 * mutations, WebSocket events).
 */

import { shouldBlock, mark } from '../utils/requestGovernor';

/**
 * Invalidate a query key only if it hasn't been invalidated recently
 * 
 * @param {QueryClient} queryClient - React Query client
 * @param {object} queryKeyConfig - Query key config for invalidateQueries (e.g., { queryKey: ['projects'] })
 * @param {number} cooldownMs - Cooldown period in milliseconds (default: 1000ms)
 * @returns {boolean} - True if invalidation executed, false if blocked
 */
export function invalidateOnce(queryClient, queryKeyConfig, cooldownMs = 1000) {
  const key = `invalidate:${JSON.stringify(queryKeyConfig.queryKey)}`;
  
  if (shouldBlock(key, cooldownMs)) {
    console.log(`[InvalidateOnce] Blocked duplicate invalidation:`, queryKeyConfig.queryKey);
    return false;
  }
  
  mark(key);
  queryClient.invalidateQueries(queryKeyConfig);
  return true;
}

/**
 * Batch invalidate multiple query keys with shared cooldown
 * Only invalidates if none of the keys were recently invalidated
 * 
 * @param {QueryClient} queryClient - React Query client
 * @param {Array<object>} queryKeyConfigs - Array of query key configs
 * @param {number} cooldownMs - Cooldown period in milliseconds (default: 1000ms)
 * @returns {boolean} - True if invalidation executed, false if blocked
 */
export function invalidateBatchOnce(queryClient, queryKeyConfigs, cooldownMs = 1000) {
  const batchKey = `invalidate-batch:${queryKeyConfigs.map(q => JSON.stringify(q.queryKey)).join(',')}`;
  
  if (shouldBlock(batchKey, cooldownMs)) {
    console.log(`[InvalidateOnce] Blocked duplicate batch invalidation`);
    return false;
  }
  
  mark(batchKey);
  queryKeyConfigs.forEach(config => {
    queryClient.invalidateQueries(config);
  });
  return true;
}