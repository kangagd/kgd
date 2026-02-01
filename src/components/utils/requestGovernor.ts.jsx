/**
 * Request Governor - Prevents request storms by tracking and blocking repeated calls
 * 
 * Usage:
 * - shouldBlock(key, ms): Check if a request should be blocked
 * - mark(key): Mark a request as executed
 * - withCooldown(key, ms, fn): Execute a function with cooldown protection
 */

const callTimestamps = new Map<string, number>();

/**
 * Check if a request should be blocked based on cooldown period
 */
export function shouldBlock(key: string, cooldownMs: number): boolean {
  const lastCall = callTimestamps.get(key);
  if (!lastCall) return false;
  
  const elapsed = Date.now() - lastCall;
  return elapsed < cooldownMs;
}

/**
 * Mark a request as executed (updates timestamp)
 */
export function mark(key: string): void {
  callTimestamps.set(key, Date.now());
}

/**
 * Execute a function with cooldown protection
 * Returns null if blocked, otherwise executes and returns the function result
 */
export async function withCooldown<T>(
  key: string, 
  cooldownMs: number, 
  fn: () => T | Promise<T>
): Promise<T | null> {
  if (shouldBlock(key, cooldownMs)) {
    console.log(`[RequestGovernor] Blocked: ${key} (cooldown: ${cooldownMs}ms)`);
    return null;
  }
  
  mark(key);
  return await fn();
}

/**
 * Clear all cooldown timers (useful for testing or manual reset)
 */
export function clearCooldowns(): void {
  callTimestamps.clear();
}

/**
 * Get time remaining in cooldown (in ms), or 0 if not blocked
 */
export function getCooldownRemaining(key: string, cooldownMs: number): number {
  const lastCall = callTimestamps.get(key);
  if (!lastCall) return 0;
  
  const elapsed = Date.now() - lastCall;
  const remaining = cooldownMs - elapsed;
  return Math.max(0, remaining);
}