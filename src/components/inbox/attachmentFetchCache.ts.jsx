/**
 * Session-based attachment fetch cache to prevent request storms
 * Implements circuit breaker pattern for failed inline CID images
 */

interface AttachmentCacheEntry {
  state: 'ok' | 'failed' | 'loading';
  url?: string;
  lastAttemptAt?: number;
  errorCode?: number;
  retryCount?: number;
}

const cache = new Map<string, AttachmentCacheEntry>();

// Circuit breaker: block retries for 5 minutes after failure
const CIRCUIT_BREAKER_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_COUNT = 1; // Allow one retry before circuit break

export function buildCacheKey(threadId: string, messageId: string, cidOrAttachmentId: string): string {
  return `${threadId}:${messageId}:${cidOrAttachmentId}`;
}

export function getCacheEntry(key: string): AttachmentCacheEntry | undefined {
  return cache.get(key);
}

export function setCacheEntry(key: string, entry: AttachmentCacheEntry): void {
  cache.set(key, entry);
}

export function shouldAttemptFetch(key: string): boolean {
  const entry = cache.get(key);
  
  // No entry - can fetch
  if (!entry) return true;
  
  // Already loading - don't fetch
  if (entry.state === 'loading') return false;
  
  // Already succeeded - don't fetch
  if (entry.state === 'ok' && entry.url) return false;
  
  // Failed - check circuit breaker
  if (entry.state === 'failed') {
    const now = Date.now();
    const timeSinceLastAttempt = now - (entry.lastAttemptAt || 0);
    
    // Circuit breaker active - block retry
    if (timeSinceLastAttempt < CIRCUIT_BREAKER_DURATION) {
      return false;
    }
    
    // Too many retries - permanent fail
    if ((entry.retryCount || 0) >= MAX_RETRY_COUNT) {
      return false;
    }
    
    // Circuit breaker expired - allow retry
    return true;
  }
  
  return false;
}

export function markAsLoading(key: string): void {
  cache.set(key, {
    state: 'loading',
    lastAttemptAt: Date.now()
  });
}

export function markAsSuccess(key: string, url: string): void {
  cache.set(key, {
    state: 'ok',
    url,
    lastAttemptAt: Date.now()
  });
}

export function markAsFailed(key: string, errorCode?: number): void {
  const existing = cache.get(key);
  const retryCount = (existing?.retryCount || 0) + 1;
  
  cache.set(key, {
    state: 'failed',
    errorCode,
    lastAttemptAt: Date.now(),
    retryCount
  });
}

export function clearCache(): void {
  cache.clear();
}

export function resetCacheEntry(key: string): void {
  cache.delete(key);
}