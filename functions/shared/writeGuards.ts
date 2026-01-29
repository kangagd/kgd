
/**
 * Write Guards - Optimistic Locking Helpers
 * 
 * Prevents stale writes by enforcing write_version checks.
 * Use this to detect and reject concurrent updates.
 */

/**
 * Assert that the entity's write_version matches the expected version.
 * Throws an error if versions don't match (stale write detected).
 * 
 * @param {Object} base44 - Base44 SDK client
 * @param {string} entityName - Name of the entity (e.g., "PurchaseOrder", "Part")
 * @param {string} entityId - ID of the entity record
 * @param {number} expectedWriteVersion - Expected write_version from client
 * @throws {Error} If write_version doesn't match (stale write)
 */
export async function assertWriteVersion(base44, entityName, entityId, expectedWriteVersion) {
    if (expectedWriteVersion === undefined || expectedWriteVersion === null) {
        // No version provided - backwards compatible, allow write
        return;
    }

    // Fetch current entity
    const entity = await base44.asServiceRole.entities[entityName].get(entityId);
    
    if (!entity) {
        throw new Error(`${entityName} not found: ${entityId}`);
    }

    const currentVersion = entity.write_version || 1;

    if (currentVersion !== expectedWriteVersion) {
        throw new Error(
            `STALE_WRITE: ${entityName} ${entityId} has been modified by another user. ` +
            `Expected version ${expectedWriteVersion}, but current version is ${currentVersion}. ` +
            `Please refresh and try again.`
        );
    }
}

/**
 * Increment write_version and set write_source for an entity update.
 * Call this after successful update to prepare metadata for the next write.
 * 
 * @param {Object} entity - The entity object (must have write_version)
 * @param {string} writeSource - Source of the write: 'ui', 'sync', 'migration'
 * @returns {Object} Update payload with incremented write_version and write_source
 */
export function incrementWriteVersion(entity, writeSource = 'ui') {
    const currentVersion = entity.write_version || 1;
    
    return {
        write_version: currentVersion + 1,
        write_source: writeSource
    };
}

export * from "./writeGuards.ts";
