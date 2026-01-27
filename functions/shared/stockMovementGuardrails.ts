import crypto from 'crypto';

/**
 * Build deterministic idempotency key for StockMovement
 * Components: source, source_id, movement_type, from_location_id, to_location_id, 
 *             price_list_item_id, item_sku, quantity, occurred_at (rounded to minute)
 */
export function buildStockMovementIdempotencyKey(payload) {
  const {
    source,
    source_id,
    movement_type,
    from_location_id,
    to_location_id,
    price_list_item_id,
    item_sku,
    quantity,
    occurred_at
  } = payload;

  // Round occurred_at to minute precision for stability
  let occurrenceMinute = '';
  if (occurred_at) {
    const date = new Date(occurred_at);
    occurrenceMinute = date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  }

  const components = [
    source || '',
    source_id || '',
    movement_type || '',
    from_location_id || '',
    to_location_id || '',
    price_list_item_id || '',
    item_sku || '',
    quantity || '0',
    occurrenceMinute
  ].join('|');

  // SHA-256 hash for consistent key
  const hash = crypto
    .createHash('sha256')
    .update(components)
    .digest('hex')
    .slice(0, 16); // First 16 chars for readability

  return `smov_${hash}`;
}

/**
 * Normalize source value to canonical form
 * Old/legacy values are mapped to modern ones
 */
export function normalizeStockMovementSource(source) {
  const mapping = {
    'po_receipt': 'purchase_order_receipt',
    'po_receive': 'purchase_order_receipt',
    'logistics_job': 'logistics_job_transfer',
    'logistics': 'logistics_job_transfer',
    'job_usage': 'job_usage',
    'transfer': 'inventory_transfer',
    'adjustment': 'stock_adjustment',
    'manual': 'manual'
  };

  const normalized = mapping[source?.toLowerCase()] || source;
  const wasNormalized = normalized !== source;

  return {
    normalized,
    wasNormalized,
    original: source
  };
}

/**
 * Validate and normalize StockMovement payload
 * Throws with clear error if validation fails
 */
export async function validateInventoryWrite(base44, payload) {
  const errors = [];

  // 1. Quantity must be non-zero
  if (!payload.quantity || payload.quantity === 0) {
    errors.push('quantity must be non-zero');
  }

  // 2. Must have price_list_item_id OR item_sku
  if (!payload.price_list_item_id && !payload.item_sku) {
    errors.push('must have either price_list_item_id or item_sku');
  }

  // 3. Source must be present (after normalization)
  const sourceNorm = normalizeStockMovementSource(payload.source);
  if (!sourceNorm.normalized) {
    errors.push('source is required and invalid');
  }

  // 4. Idempotency key must be present (or will be generated)
  if (!payload.idempotency_key) {
    payload.idempotency_key = buildStockMovementIdempotencyKey(payload);
  }

  if (errors.length > 0) {
    throw new Error(`StockMovement validation failed: ${errors.join('; ')}`);
  }

  return payload;
}

/**
 * Fetch or create StockMovement using idempotency guarantee
 * - If record with same idempotency_key exists, return it
 * - Else create new record
 */
export async function createStockMovementIdempotent(base44, payload) {
  // Validate first
  await validateInventoryWrite(base44, payload);

  // Check for existing record with same idempotency key
  const existing = await base44.asServiceRole.entities.StockMovement.filter(
    { idempotency_key: payload.idempotency_key },
    undefined,
    1
  );

  if (existing.length > 0) {
    console.log(`[StockMovement] Duplicate idempotency_key detected, returning existing: ${payload.idempotency_key}`);
    return existing[0];
  }

  // Create new
  return await base44.asServiceRole.entities.StockMovement.create(payload);
}

/**
 * Enrich StockMovement payload with durable identity (item_sku + item_label)
 * - If price_list_item_id present: fetch PriceListItem and copy sku/label
 * - Else if no price_list_item_id but item_name: generate CUSTOM sku
 */
export async function enrichStockMovementWithDurableIdentity(base44, payload) {
  if (payload.price_list_item_id) {
    // Fetch PriceListItem and snapshot sku/name
    try {
      const item = await base44.asServiceRole.entities.PriceListItem.get(payload.price_list_item_id);
      if (item) {
        payload.item_sku = item.sku || `SKU_${payload.price_list_item_id}`;
        payload.item_label = item.name || item.item || 'Unknown Item';
      }
    } catch (err) {
      console.warn(`Could not fetch PriceListItem ${payload.price_list_item_id}:`, err);
    }
  } else if (payload.item_name && !payload.item_sku) {
    // Custom item: generate stable sku from name
    const hash = crypto
      .createHash('sha256')
      .update(payload.item_name)
      .digest('hex')
      .slice(0, 8);
    payload.item_sku = `CUSTOM_${hash}`;
    payload.item_label = payload.item_name;
  }

  return payload;
}