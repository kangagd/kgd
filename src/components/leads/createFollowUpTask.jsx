/**
 * Lead Management Console - Create Follow-up Task Helper
 * 
 * Maps LeadView + project data to Task entity creation.
 * No N+1 queries; uses already-fetched data.
 */

// ============================================================================
// MAPPING HELPERS
// ============================================================================

/**
 * Map next_action to Task type
 */
const mapNextActionToTaskType = (nextAction) => {
  const mapping = {
    call: "Call",
    email: "Email",
    sms: "Follow-up",
    wait: "Follow-up",
    archive: "Other",
    none: "Other",
  };
  return mapping[nextAction] || "Follow-up";
};

/**
 * Map temperature_bucket to Task priority
 */
const mapTemperatureToPriority = (tempBucket) => {
  const mapping = {
    hot: "High",
    warm: "Medium",
    cold: "Low",
  };
  return mapping[tempBucket] || "Medium";
};

/**
 * Extract ISO date portion from ISO string (YYYY-MM-DD)
 */
const extractDateOnly = (isoString) => {
  if (!isoString || typeof isoString !== "string") return null;
  const match = isoString.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Find primary (most recent) thread for project
 */
const getPrimaryThread = (threadsForProject = []) => {
  if (!Array.isArray(threadsForProject) || threadsForProject.length === 0) {
    return null;
  }

  const sorted = [...threadsForProject]
    .filter((t) => t && !t.deleted_at && !t.is_deleted)
    .sort((a, b) => {
      const aTime = a.last_message_date || a.lastMessageDate || a.last_message_at || a.updated_at || "";
      const bTime = b.last_message_date || b.lastMessageDate || b.last_message_at || b.updated_at || "";
      return bTime.localeCompare(aTime);
    });

  return sorted[0] || null;
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Create a follow-up Task for a lead.
 * 
 * @param {Object} params
 * @param {Object} params.lead - Derived LeadView object
 * @param {Object|null} params.project - Raw Project entity (optional)
 * @param {Array} params.threadsForProject - EmailThread entities for this project
 * @param {Object} params.base44 - Base44 SDK client
 * @param {string|null} params.nowIso - Current ISO timestamp (for defaults)
 * @returns {Promise<Object>} Created Task entity
 */
export async function createFollowUpTask({ lead, project, threadsForProject = [], base44, nowIso = null }) {
  // Validate inputs
  if (!lead || typeof lead !== "object") {
    throw new Error("Lead data is required");
  }

  if (!lead.project_id) {
    throw new Error("Lead must have a project_id");
  }

  if (!base44 || !base44.entities?.Task?.create) {
    throw new Error("Base44 SDK client is required");
  }

  // Build task title
  const customerName = lead.customer_name || project?.title || project?.name || lead.title || "Lead";
  const title = `Follow up: ${customerName}`;

  // Build task description
  const descriptionParts = [];
  
  if (lead.next_action) {
    descriptionParts.push(`**Recommended Action:** ${lead.next_action.replace(/_/g, " ")}`);
  }
  
  if (lead.next_action_reason) {
    descriptionParts.push(`**Reason:** ${lead.next_action_reason}`);
  }
  
  if (lead.lead_stage) {
    descriptionParts.push(`**Lead Stage:** ${lead.lead_stage.replace(/_/g, " ")}`);
  }
  
  if (lead.temperature_bucket) {
    descriptionParts.push(`**Temperature:** ${lead.temperature_bucket} (score: ${lead.temperature_score || 0})`);
  }
  
  if (lead.primary_quote_status || lead.primary_quote_value) {
    const quoteStatus = lead.primary_quote_status || "unknown";
    const quoteValue = lead.primary_quote_value
      ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(lead.primary_quote_value)
      : "—";
    descriptionParts.push(`**Quote:** ${quoteStatus} • ${quoteValue}`);
  }
  
  if (lead.days_since_customer !== null && lead.days_since_customer !== undefined) {
    const days = lead.days_since_customer === 0 ? "today" : `${lead.days_since_customer} days ago`;
    descriptionParts.push(`**Last Customer Activity:** ${days}`);
  }
  
  if (lead.last_message_at) {
    try {
      const date = new Date(lead.last_message_at);
      const formatted = new Intl.DateTimeFormat("en-AU", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
      descriptionParts.push(`**Last Message:** ${formatted}`);
    } catch {
      // Skip if date parsing fails
    }
  }

  const description = descriptionParts.join("\n\n");

  // Map type and priority
  const type = mapNextActionToTaskType(lead.next_action);
  const priority = mapTemperatureToPriority(lead.temperature_bucket);

  // Determine due_date
  let dueDate = getTodayDate();
  if (lead.follow_up_due_at) {
    const extracted = extractDateOnly(lead.follow_up_due_at);
    if (extracted) {
      dueDate = extracted;
    }
  }

  // Find primary thread
  const primaryThread = getPrimaryThread(threadsForProject);

  // Build Task payload
  const taskPayload = {
    title,
    description,
    status: "Open",
    type,
    priority,
    due_date: dueDate,
    due_time: "09:00", // Default follow-up time
    project_id: lead.project_id,
    project_name: project?.title || project?.name || lead.title || null,
    customer_id: project?.customer_id || lead.customer_id || null,
    customer_name: lead.customer_name || null,
    email_thread_id: primaryThread?.id || null,
    email_thread_subject: primaryThread?.subject || primaryThread?.email_thread_subject || null,
    // Assignment fields left null (to be added in future prompt)
    assigned_to_user_id: null,
    assigned_to_name: null,
    assigned_to_email: null,
  };

  // Create Task
  const createdTask = await base44.entities.Task.create(taskPayload);

  return createdTask;
}