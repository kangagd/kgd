import { base44 } from '@/api/base44Client';

let cachedIntegrityMode = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Check if DATA_INTEGRITY_MODE is enabled
 * Returns: { enabled: boolean, setting: object | null }
 */
export async function checkDataIntegrityMode() {
  const now = Date.now();
  
  // Use cache if fresh
  if (cachedIntegrityMode !== null && (now - lastFetch) < CACHE_TTL) {
    return cachedIntegrityMode;
  }

  try {
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'DATA_INTEGRITY_MODE' });
    const setting = settings.length > 0 ? settings[0] : null;
    const enabled = setting?.value === true;
    
    cachedIntegrityMode = { enabled, setting };
    lastFetch = now;
    
    return cachedIntegrityMode;
  } catch (e) {
    console.warn('Could not check DATA_INTEGRITY_MODE:', e.message);
    return { enabled: false, setting: null };
  }
}

/**
 * Block background writes to canonical entities when DATA_INTEGRITY_MODE is ON
 * Returns: { allowed: boolean, reason: string | null }
 */
export async function canPerformBackgroundWrite(entityName, writeSource = 'sync') {
  const canonicalEntities = ['Part', 'StockMovement', 'EmailDraft'];
  
  // Only check canonical entities
  if (!canonicalEntities.includes(entityName)) {
    return { allowed: true, reason: null };
  }

  const { enabled } = await checkDataIntegrityMode();
  
  if (enabled && writeSource === 'sync') {
    return {
      allowed: false,
      reason: 'DATA_INTEGRITY_MODE: Background sync writes disabled for canonical entities'
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Invalidate cache (call after toggling DATA_INTEGRITY_MODE)
 */
export function invalidateIntegrityModeCache() {
  cachedIntegrityMode = null;
  lastFetch = 0;
}