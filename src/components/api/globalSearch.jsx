import { base44 } from "@/api/base44Client";

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
    // We use a catch block for each entity to ensure one failure doesn't break the whole search
    const [jobsRes, projectsRes, customersRes] = await Promise.all([
      base44.entities.Job.filter({ search: query }, null, 10).catch(err => {
        console.error("Error searching jobs:", err);
        return [];
      }),
      base44.entities.Project.filter({ search: query }, null, 10).catch(err => {
        console.error("Error searching projects:", err);
        return [];
      }),
      base44.entities.Customer.filter({ search: query }, null, 10).catch(err => {
        console.error("Error searching customers:", err);
        return [];
      }),
    ]);

    const normalize = (res) => (Array.isArray(res) ? res : res?.data || []);

    return {
      jobs: normalize(jobsRes),
      projects: normalize(projectsRes),
      customers: normalize(customersRes),
    };
  } catch (error) {
    console.error("Global search error:", error);
    return { jobs: [], projects: [], customers: [] };
  }
}