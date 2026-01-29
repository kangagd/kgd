
import { LOGISTICS_PURPOSE, ALL_LOGISTICS_PURPOSES } from './logisticsPurpose.js';

/**
 * PURPOSE_CODES mapping for job numbering (e.g., "4781-PART-PU")
 */
export const PURPOSE_CODES = {
  [LOGISTICS_PURPOSE.PO_DELIVERY_TO_WAREHOUSE]: 'PO-DEL',
  [LOGISTICS_PURPOSE.PO_PICKUP_FROM_SUPPLIER]: 'PO-PU',
  [LOGISTICS_PURPOSE.PART_PICKUP_FOR_INSTALL]: 'PART-PU',
  [LOGISTICS_PURPOSE.MANUAL_CLIENT_DROPOFF]: 'DROP',
  [LOGISTICS_PURPOSE.SAMPLE_DROPOFF]: 'SAMP-DO',
  [LOGISTICS_PURPOSE.SAMPLE_PICKUP]: 'SAMP-PU',
};

/**
 * Reverse mapping: human labels to canonical codes
 */
const HUMAN_LABELS = {
  'po delivery to warehouse': LOGISTICS_PURPOSE.PO_DELIVERY_TO_WAREHOUSE,
  'po pickup from supplier': LOGISTICS_PURPOSE.PO_PICKUP_FROM_SUPPLIER,
  'part pickup for install': LOGISTICS_PURPOSE.PART_PICKUP_FOR_INSTALL,
  'manual client dropoff': LOGISTICS_PURPOSE.MANUAL_CLIENT_DROPOFF,
  'sample dropoff': LOGISTICS_PURPOSE.SAMPLE_DROPOFF,
  'sample pickup': LOGISTICS_PURPOSE.SAMPLE_PICKUP,
  // Variants
  'drop': LOGISTICS_PURPOSE.MANUAL_CLIENT_DROPOFF,
  'sample drop-off': LOGISTICS_PURPOSE.SAMPLE_DROPOFF,
  'sample pick-up': LOGISTICS_PURPOSE.SAMPLE_PICKUP,
};

/**
 * Normalize logistics purpose to canonical code
 * Never returns null; falls back to "other" if unmapped
 * 
 * @param {string} input - Raw input (code, label, or loose format)
 * @returns {{ purpose_code: string, purpose_raw: string|null, ok: boolean }}
 */
export function normalizeLogisticsPurpose(input) {
  if (!input) {
    return {
      purpose_code: 'other',
      purpose_raw: null,
      ok: false
    };
  }

  const raw = String(input).trim();

  // Check if already a valid canonical code
  if (ALL_LOGISTICS_PURPOSES.includes(raw)) {
    return {
      purpose_code: raw,
      purpose_raw: raw,
      ok: true
    };
  }

  // Check if it's a valid PURPOSE_CODE value (e.g., "PART-PU")
  if (Object.values(PURPOSE_CODES).includes(raw)) {
    // Reverse lookup to get canonical code
    for (const [code, purposeCode] of Object.entries(PURPOSE_CODES)) {
      if (purposeCode === raw) {
        return {
          purpose_code: code,
          purpose_raw: raw,
          ok: true
        };
      }
    }
  }

  // Try human label match (case-insensitive)
  const normalized = raw.toLowerCase().replace(/[\-_]+/g, ' ');
  if (HUMAN_LABELS[normalized]) {
    return {
      purpose_code: HUMAN_LABELS[normalized],
      purpose_raw: raw,
      ok: true
    };
  }

  // Loose matching: try to find a partial match in human labels
  for (const [label, code] of Object.entries(HUMAN_LABELS)) {
    if (label.includes(normalized) || normalized.includes(label)) {
      return {
        purpose_code: code,
        purpose_raw: raw,
        ok: false // Partial match, not strict
      };
    }
  }

  // Fallback: cannot map
  return {
    purpose_code: 'other',
    purpose_raw: raw,
    ok: false
  };
}

/**
 * Check if a purpose code is valid
 */
export function isValidPurpose(code) {
  if (!code) return false;
  return ALL_LOGISTICS_PURPOSES.includes(code) || code === 'other';
}

/**
 * Get PURPOSE_CODE for a given logistics_purpose
 */
export function getPurposeCode(logisticsPurpose) {
  if (!logisticsPurpose) return 'LOG';
  return PURPOSE_CODES[logisticsPurpose] || 'LOG';
}
