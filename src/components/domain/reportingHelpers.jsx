import { PROJECT_STAGES } from "./projectStages";
import { JOB_STATUS_OPTIONS } from "./jobConfig";

export const countProjectsByStage = (projects = []) => {
  const counts = projects.reduce((acc, project) => {
    const stage = project.status;
    if (stage) {
      acc[stage] = (acc[stage] || 0) + 1;
    }
    return acc;
  }, {});

  return PROJECT_STAGES.map(stage => ({
    stage,
    count: counts[stage] || 0
  }));
};

export const countJobsByStatus = (jobs = []) => {
  const counts = jobs.reduce((acc, job) => {
    const status = job.status;
    if (status) {
      acc[status] = (acc[status] || 0) + 1;
    }
    return acc;
  }, {});

  return JOB_STATUS_OPTIONS.map(status => ({
    status,
    count: counts[status] || 0
  }));
};

export const groupByMonth = (records = [], dateField) => {
  const groups = records.reduce((acc, record) => {
    const dateVal = record[dateField];
    if (!dateVal) return acc;

    try {
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return acc;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      acc[key] = (acc[key] || 0) + 1;
    } catch (e) {
      // ignore invalid dates
    }
    return acc;
  }, {});

  return Object.entries(groups)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

// Note: Using 'created_date' as it is the standard Base44 built-in attribute
export const getProjectCreatedByMonth = (projects) => groupByMonth(projects, "created_date");
export const getProjectCompletedByMonth = (projects) => groupByMonth(projects, "completed_date");

export const getJobCreatedByMonth = (jobs) => groupByMonth(jobs, "created_date");
export const getJobCompletedByMonth = (jobs) => groupByMonth(jobs, "completed_date");

export const getDateFromRange = (rangeKey) => {
  if (rangeKey === "all") return null;
  
  const today = new Date();
  const date = new Date(today);
  
  switch (rangeKey) {
    case "3m":
      date.setMonth(today.getMonth() - 3);
      break;
    case "12m":
      date.setMonth(today.getMonth() - 12);
      break;
    case "6m":
    default:
      date.setMonth(today.getMonth() - 6);
      break;
  }
  
  return date;
};

export const filterRecordsByDateRange = (records = [], dateField, rangeKey) => {
  const fromDate = getDateFromRange(rangeKey);
  
  if (!fromDate) {
    return records;
  }

  const today = new Date();
  // Set today to end of day to include everything today
  today.setHours(23, 59, 59, 999);
  // Set fromDate to start of day
  fromDate.setHours(0, 0, 0, 0);

  return records.filter(record => {
    const val = record[dateField];
    if (!val) return false;
    
    const recordDate = new Date(val);
    if (isNaN(recordDate.getTime())) return false;

    return recordDate >= fromDate && recordDate <= today;
  });
};