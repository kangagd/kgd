import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Assert write version (optimistic locking)
 * 
 * Usage:
 *   const result = await assertWriteVersion(base44, 'Part', partId, expectedVersion);
 *   if (!result.allowed) {
 *     return Response.json({ error: result.error }, { status: 409 });
 *   }
 *   // Proceed with update using result.nextVersion
 * 
 * Returns:
 *   { allowed: boolean, currentVersion: number, nextVersion: number, error: string | null }
 */
export async function assertWriteVersion(base44, entityName, entityId, expectedVersion) {
  if (!expectedVersion) {
    // No version check requested - allow write
    return { allowed: true, currentVersion: null, nextVersion: 1, error: null };
  }

  try {
    const EntityClass = base44.asServiceRole.entities[entityName];
    if (!EntityClass) {
      return {
        allowed: false,
        error: `Unknown entity: ${entityName}`,
        currentVersion: null,
        nextVersion: null
      };
    }

    const record = await EntityClass.get(entityId);
    if (!record) {
      return {
        allowed: false,
        error: `${entityName} ${entityId} not found`,
        currentVersion: null,
        nextVersion: null
      };
    }

    const currentVersion = record.write_version || 1;

    // Check for stale write
    if (expectedVersion < currentVersion) {
      return {
        allowed: false,
        error: `Stale write detected: expected version ${expectedVersion}, current is ${currentVersion}`,
        currentVersion,
        nextVersion: null,
        code: 'STALE_WRITE'
      };
    }

    return {
      allowed: true,
      currentVersion,
      nextVersion: currentVersion + 1,
      error: null
    };
  } catch (error) {
    return {
      allowed: false,
      error: error.message,
      currentVersion: null,
      nextVersion: null
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_name, entity_id, expected_version } = await req.json();

    if (!entity_name || !entity_id) {
      return Response.json({ error: 'entity_name and entity_id are required' }, { status: 400 });
    }

    const result = await assertWriteVersion(base44, entity_name, entity_id, expected_version);

    if (!result.allowed) {
      return Response.json(result, { status: 409 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});