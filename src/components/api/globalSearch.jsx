import { base44 } from "@/api/base44Client";

/**
 * Run a safe search against a single entity.
 * Never throws – always returns an array.
 */
async function safeEntitySearch(entityName, criteria) {
  try {
    const entity = base44?.entities?.[entityName];
    if (!entity || typeof entity.filter !== "function") {
      console.warn(`Global search: entity "${entityName}" or its filter() is not available`);
      return [];
    }

    // Prefer the simplest, most future-proof call signature
    const res = await entity.filter(criteria);

    // Normalise various possible return shapes
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.results)) return res.results;

    return [];
  } catch (err) {
    console.error(`Error searching ${entityName}:`, err);
    return [];
  }
}

/**
 * Searches across key entities: Jobs, Projects, Customers.
 * @param {string} query - The search query string.
 * @returns {Promise<{jobs: Array, projects: Array, customers: Array}>}
 */
export async function searchAll(query) {
  if (!query || query.length < 2) {
    return { jobs: [], projects: [], customers: [] };
  }

  try {
    const [jobs, projects, customers] = await Promise.all([
      safeEntitySearch("Job", { search: query }),
      safeEntitySearch("Project", { search: query }),
      safeEntitySearch("Customer", { search: query }),
    ]);

    return { jobs, projects, customers };
  } catch (error) {
    // This should realistically never fire now
    console.error("Global search error:", error);
    return { jobs: [], projects: [], customers: [] };
  }
}