import { base44 } from "@/api/base44Client";

/**
 * Fetch paginated list of entities with cursor-based pagination
 * @param {string} entityName - Entity name (e.g., 'Job', 'Project')
 * @param {Object} options
 * @param {Object} options.filters - Filter criteria
 * @param {string} options.sort - Sort field (prefix with '-' for desc)
 * @param {number} options.limit - Items per page (default: 50)
 * @param {string} options.cursor - Pagination cursor
 * @returns {Promise<{data: Array, nextCursor: string|null}>}
 */
export async function fetchList(entityName, { filters = {}, sort = '-created_date', limit = 50, cursor = null } = {}) {
  try {
    const entity = base44.entities[entityName];
    
    if (!entity) {
      throw new Error(`Entity ${entityName} not found`);
    }

    // Try cursor-based pagination if supported
    if (entity.paginate && typeof entity.paginate === 'function') {
      const result = await entity.paginate(filters, sort, limit, cursor);
      return {
        data: result.data || result.items || [],
        nextCursor: result.nextCursor || result.cursor || null
      };
    }

    // Fallback to filter with limit
    if (cursor) {
      // If cursor provided but pagination not supported, return empty
      // (indicates we've fetched all in previous call)
      return { data: [], nextCursor: null };
    }

    const data = await entity.filter(filters, sort, limit);
    
    return {
      data: Array.isArray(data) ? data : [],
      nextCursor: data.length >= limit ? 'has-more' : null
    };
  } catch (error) {
    console.error(`fetchList error for ${entityName}:`, error);
    return { data: [], nextCursor: null };
  }
}