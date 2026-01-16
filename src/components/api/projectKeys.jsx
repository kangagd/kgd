
export const projectKeys = {
  all: () => ["projects"],
  list: () => ["projects", "list"],
  detail: (projectId) => ["projects", "detail", projectId],
  withRelations: (projectId, tab) => ["projects", "withRelations", projectId, tab || "all"],
  drafts: (projectId) => ["projects", "drafts", projectId],
};
