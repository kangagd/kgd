import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import crypto from 'node:crypto';

/**
 * Enforce write guards: stale write protection, idempotency, field normalization
 * Returns { allowed: boolean, patch: object, error: string | null }
 */
async function enforceWriteGuards(base44, entity, entityId, incomingPatch, currentRecord, integrityMode, user) {
  const errors = [];
  const patch = { ...incomingPatch };
  
  // GUARD 1: Stale write detection (optimistic lock)
  if (incomingPatch.write_version !== undefined && currentRecord.write_version !== undefined) {
    if (incomingPatch.write_version < currentRecord.write_version) {
      return {
        allowed: false,
        error: `stale_write: incoming version ${incomingPatch.write_version} < current ${currentRecord.write_version}`,
        code: 'STALE_WRITE'
      };
    }
  }
  
  // GUARD 2: Increment write_version
  patch.write_version = (currentRecord.write_version || 1) + 1;
  
  // GUARD 3: Track write source and user
  patch.updated_by = user.email;
  if (!patch.write_source) {
    patch.write_source = 'ui';
  }
  
  // GUARD 4: In DATA_INTEGRITY_MODE, reject sync writes to canonical entities
  if (integrityMode && patch.write_source === 'sync') {
    return {
      allowed: false,
      error: 'DATA_INTEGRITY_MODE: Background sync writes are disabled',
      code: 'SYNC_DISABLED'
    };
  }
  
  // GUARD 5: Normalize fields per entity type
  if (entity === 'EmailDraft') {
    // Extract image_urls from body_html if present
    if (patch.body_html) {
      const imageRegex = /<img[^>]+(?:src|file_url|data-url)=["']([^"']+)["'][^>]*>/g;
      const images = [];
      let match;
      while ((match = imageRegex.exec(patch.body_html)) !== null) {
        if (!images.includes(match[1])) {
          images.push(match[1]);
        }
      }
      if (images.length > 0) {
        patch.image_urls = images;
      }
    }
  }
  
  if (entity === 'StockMovement') {
    // Ensure source is valid enum
    if (patch.source && !['transfer', 'job_usage', 'po_receive', 'manual', 'sync', 'logistics_job_completion', 'manual_adjustment', 'po_receipt'].includes(patch.source)) {
      return {
        allowed: false,
        error: `Invalid source: ${patch.source}`,
        code: 'INVALID_SOURCE'
      };
    }
    
    // Generate idempotency_key if missing
    if (!patch.idempotency_key && (patch.job_id || patch.part_id || patch.quantity)) {
      const sig = `${patch.job_id || patch.part_id}|${patch.source || 'unknown'}|${patch.quantity || 0}|${patch.to_location_id || patch.to_vehicle_id || 'external'}`;
      patch.idempotency_key = crypto.createHash('sha256').update(sig).digest('hex').substring(0, 16);
    }
  }
  
  if (entity === 'Part') {
    // Validate write_source enum
    if (patch.write_source && !['ui', 'sync', 'migration'].includes(patch.write_source)) {
      return {
        allowed: false,
        error: `Invalid write_source: ${patch.write_source}`,
        code: 'INVALID_WRITE_SOURCE'
      };
    }
  }
  
  return {
    allowed: true,
    patch,
    error: null
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity, entity_id, incoming_patch, current_record } = await req.json();
    
    if (!entity || !entity_id) {
      return Response.json({ error: 'entity and entity_id required' }, { status: 400 });
    }

    // Fetch DATA_INTEGRITY_MODE setting
    let integrityMode = false;
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'DATA_INTEGRITY_MODE' });
      if (settings.length > 0) {
        integrityMode = settings[0].value === true;
      }
    } catch (e) {
      console.warn('Could not fetch DATA_INTEGRITY_MODE setting:', e.message);
    }

    // Get current record if not provided
    let current = current_record;
    if (!current) {
      try {
        const EntityClass = base44.asServiceRole.entities[entity];
        current = await EntityClass.get(entity_id);
      } catch (e) {
        return Response.json({ error: `Could not fetch ${entity} ${entity_id}` }, { status: 404 });
      }
    }

    const result = await enforceWriteGuards(base44, entity, entity_id, incoming_patch, current || {}, integrityMode, user);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});