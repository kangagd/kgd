export const projectKeys = {
  all: () => ["projects"],
  list: () => ["projects", "list"],
  detail: (projectId) => ["projects", "detail", projectId],
  withRelations: (projectId) => ["projects", "withRelations", projectId],
};