import { base44 } from "@/api/base44Client";

/**
 * Normalise any entity list / filter response into an array.
 */
function normaliseRecords(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.items)) return res.items;
  return [];
}

/**
 * Run a safe search against a single entity.
 * Prefer server-side search via filter({ search }), but
 * falls back to list() + client-side filtering.
 * Never throws – always returns an array.
 */
async function safeEntitySearch(entityName, query, fallbackFields = []) {
  try {
    const entity = base44?.entities?.[entityName];
    if (!entity) {
      console.warn(`Global search: entity "${entityName}" is not available`);
      return [];
    }

    const lowerQuery = query.toLowerCase();

    // 1) Prefer server-side search if filter() exists
    if (typeof entity.filter === "function") {
      try {
        // Try the most modern signature first: filter(criteria, options)
        let res = await entity.filter({ search: query }, { limit: 20 });
        let records = normaliseRecords(res);

        // If nothing came back, still fall back to list+client-filter
        if (records.length > 0 || fallbackFields.length === 0) {
          return records;
        }

        // continue below to list() if necessary
      } catch (e) {
        console.warn(`Global search: filter() failed for ${entityName}, falling back to list()`, e);
      }
    }

    // 2) Fallback: list() + client-side filtering
    if (typeof entity.list === "function") {
      const res = await entity.list();
      const records = normaliseRecords(res);

      if (!fallbackFields.length) {
        return records;
      }

      return records.filter((record) =>
        fallbackFields.some((field) => {
          const value = record[field];
          if (!value) return false;
          return value.toString().toLowerCase().includes(lowerQuery);
        })
      );
    }

    console.warn(
      `Global search: neither filter() nor list() available for entity "${entityName}"`
    );
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
      safeEntitySearch("Job", query, [
        "job_number",
        "customer_name",
        "address",
        "address_full",
        "notes",
      ]),
      safeEntitySearch("Project", query, [
        "project_number",
        "customer_name",
        "title",
        "address",
        "address_full",
        "notes",
      ]),
      safeEntitySearch("Customer", query, [
        "name",
        "email",
        "phone",
        "address_full",
        "notes",
      ]),
    ]);

    return { jobs, projects, customers };
  } catch (error) {
    // This should realistically never fire now
    console.error("Global search error:", error);
    return { jobs: [], projects: [], customers: [] };
  }
}
