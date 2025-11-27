import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Create a notification for a user
 * Can be called from frontend for immediate notifications
 */
export async function createNotification({
  userEmail,
  userId,
  title,
  body,
  type = 'info',
  relatedEntityType,
  relatedEntityId,
  showToast = false
}) {
  try {
    const response = await base44.functions.invoke('createNotification', {
      userEmail,
      userId,
      title,
      body,
      type,
      relatedEntityType,
      relatedEntityId
    });

    // Optionally show a toast for the current user
    if (showToast) {
      const currentUser = await base44.auth.me();
      if (currentUser?.email === userEmail) {
        const toastFn = type === 'error' ? toast.error 
          : type === 'warning' ? toast.warning 
          : type === 'success' ? toast.success 
          : toast.info;
        toastFn(title, { description: body });
      }
    }

    return response.data;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 */
export async function createNotificationsForUsers({
  userEmails,
  title,
  body,
  type = 'info',
  relatedEntityType,
  relatedEntityId
}) {
  const results = await Promise.all(
    userEmails.map(email => 
      createNotification({
        userEmail: email,
        title,
        body,
        type,
        relatedEntityType,
        relatedEntityId
      })
    )
  );
  return results;
}

// Pre-built notification creators for common events

export async function notifyJobAssigned(job, technicianEmails) {
  return createNotificationsForUsers({
    userEmails: technicianEmails,
    title: `Job #${job.job_number} assigned to you`,
    body: `${job.customer_name} - ${job.job_type_name || 'Job'}`,
    type: 'info',
    relatedEntityType: 'Job',
    relatedEntityId: job.id
  });
}

export async function notifyJobRescheduled(job, technicianEmails, newDate) {
  return createNotificationsForUsers({
    userEmails: technicianEmails,
    title: `Job #${job.job_number} rescheduled`,
    body: `New date: ${new Date(newDate).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`,
    type: 'warning',
    relatedEntityType: 'Job',
    relatedEntityId: job.id
  });
}

export async function notifyTechnicianCheckIn(job, technicianName, adminEmails) {
  return createNotificationsForUsers({
    userEmails: adminEmails,
    title: `${technicianName} checked in`,
    body: `Job #${job.job_number} - ${job.customer_name}`,
    type: 'info',
    relatedEntityType: 'Job',
    relatedEntityId: job.id
  });
}

export async function notifyTechnicianCheckOut(job, technicianName, adminEmails) {
  return createNotificationsForUsers({
    userEmails: adminEmails,
    title: `${technicianName} checked out`,
    body: `Job #${job.job_number} - ${job.customer_name}`,
    type: 'success',
    relatedEntityType: 'Job',
    relatedEntityId: job.id
  });
}

export async function notifyProjectStageChanged(project, newStage, userEmails) {
  return createNotificationsForUsers({
    userEmails: userEmails,
    title: `Project stage updated`,
    body: `${project.title} moved to "${newStage}"`,
    type: 'info',
    relatedEntityType: 'Project',
    relatedEntityId: project.id
  });
}

export async function notifyEmailLinkedToProject(project, emailSubject, userEmails) {
  return createNotificationsForUsers({
    userEmails: userEmails,
    title: `Email linked to project`,
    body: `"${emailSubject}" linked to ${project.title}`,
    type: 'info',
    relatedEntityType: 'Project',
    relatedEntityId: project.id
  });
}

export async function notifyTaskAssigned(task, assigneeEmail) {
  return createNotification({
    userEmail: assigneeEmail,
    title: `Task assigned to you`,
    body: task.title,
    type: 'info',
    relatedEntityType: 'Task',
    relatedEntityId: task.id
  });
}