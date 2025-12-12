import { base44 } from "@/api/base44Client";

/**
 * Run a safe search against a single entity.
 * Fetches all records and filters client-side for reliability.
 * Never throws – always returns an array.
 */
async function safeEntitySearch(entityName, query, searchFields) {
  try {
    const entity = base44?.entities?.[entityName];
    if (!entity || typeof entity.list !== "function") {
      console.warn(`Global search: entity "${entityName}" or its list() is not available`);
      return [];
    }

    // Fetch all records (server-side search filter not reliably supported)
    const res = await entity.list();

    // Normalise various possible return shapes
    let records = [];
    if (!res) return [];
    if (Array.isArray(res)) records = res;
    else if (Array.isArray(res.data)) records = res.data;
    else if (Array.isArray(res.results)) records = res.results;
    else return [];

    // Client-side filtering
    const lowerQuery = query.toLowerCase();
    return records.filter(record => {
      return searchFields.some(field => {
        const value = record[field];
        if (!value) return false;
        return value.toString().toLowerCase().includes(lowerQuery);
      });
    });
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
      safeEntitySearch("Job", query, ["job_number", "customer_name", "address", "address_full", "notes"]),
      safeEntitySearch("Project", query, ["project_number", "customer_name", "title", "address", "address_full", "notes"]),
      safeEntitySearch("Customer", query, ["name", "email", "phone", "address_full", "notes"]),
    ]);

    return { jobs, projects, customers };
  } catch (error) {
    // This should realistically never fire now
    console.error("Global search error:", error);
    return { jobs: [], projects: [], customers: [] };
  }
}