/**
 * Shared task filtering logic for consistent urgency calculations
 */

/**
 * Check if a task is active (not completed or cancelled)
 */
export const isActiveTask = (task) => {
  if (!task?.status) return true;
  const status = task.status.toLowerCase();
  return status !== 'completed' && status !== 'cancelled';
};

/**
 * Get today's date boundary (midnight local time)
 */
export const getTodayBoundary = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Get date-only boundary from a date string or Date object
 */
export const getDateBoundary = (dateInput) => {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

/**
 * Check if a task is overdue (before today)
 */
export const isOverdue = (task, today = getTodayBoundary()) => {
  if (!task?.due_date) return false;
  const dueDate = new Date(task.due_date);
  return dueDate < today;
};

/**
 * Check if a task is due today
 */
export const isDueToday = (task, today = getTodayBoundary()) => {
  if (!task?.due_date) return false;
  const dueDateBoundary = getDateBoundary(task.due_date);
  return dueDateBoundary.getTime() === today.getTime();
};

/**
 * Check if a task is due soon (within next 3 days, excluding today)
 */
export const isDueSoon = (task, today = getTodayBoundary()) => {
  if (!task?.due_date) return false;
  const dueDateBoundary = getDateBoundary(task.due_date);
  const daysUntilDue = Math.ceil((dueDateBoundary - today) / (1000 * 60 * 60 * 24));
  return daysUntilDue > 0 && daysUntilDue <= 3;
};

/**
 * Get active tasks from a list
 */
export const getActiveTasks = (tasks = []) => {
  return tasks.filter(isActiveTask);
};

/**
 * Count tasks by urgency buckets
 */
export const getTaskUrgencyCounts = (tasks = []) => {
  const activeTasks = getActiveTasks(tasks);
  const today = getTodayBoundary();
  
  return {
    overdue: activeTasks.filter(t => isOverdue(t, today)).length,
    dueToday: activeTasks.filter(t => isDueToday(t, today)).length,
    dueSoon: activeTasks.filter(t => isDueSoon(t, today)).length
  };
};

/**
 * Filter tasks by urgency bucket
 */
export const filterTasksByUrgency = (tasks = [], urgencyType) => {
  const activeTasks = getActiveTasks(tasks);
  const today = getTodayBoundary();
  
  switch (urgencyType) {
    case 'overdue':
      return activeTasks.filter(t => isOverdue(t, today));
    case 'due_today':
      return activeTasks.filter(t => isDueToday(t, today));
    case 'due_soon':
      return activeTasks.filter(t => isDueSoon(t, today));
    default:
      return activeTasks;
  }
};