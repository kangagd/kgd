export const PROJECT_STAGE_AUTOMATION = {
  "Completed": {
    handleCompletion: true,
    autoJobs: []
  },
  "Initial Site Visit": {
    handleCompletion: false,
    autoJobs: [
      { jobTypeName: "Initial Site Measure" }
    ]
  },
  "Final Measure": {
    handleCompletion: false,
    autoJobs: [
      { jobTypeName: "Final Measure" }
    ]
  },
  "Scheduled": {
    handleCompletion: false,
    autoJobs: [
      { jobTypeName: "Installation" }
    ]
  }
};