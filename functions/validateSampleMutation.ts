/**
 * Validates sample data before creation or update
 * @param {Object} params
 * @param {Object} params.sample - Sample data to validate
 * @returns {Object} { success: true } if valid
 * @throws {Error} if validation fails
 */
export function validateSampleMutation({ sample }) {
  // Rule 1: warehouse or unknown → current_location_reference_id MUST be null
  if (
    (sample.current_location_type === "warehouse" || sample.current_location_type === "unknown") &&
    sample.current_location_reference_id !== null &&
    sample.current_location_reference_id !== undefined
  ) {
    throw new Error(
      `current_location_reference_id must be null when current_location_type is ${sample.current_location_type}`
    );
  }

  // Rule 2: vehicle → current_location_reference_id MUST be non-empty string
  if (sample.current_location_type === "vehicle") {
    if (!sample.current_location_reference_id || typeof sample.current_location_reference_id !== "string") {
      throw new Error("current_location_reference_id must be a non-empty string when current_location_type is vehicle");
    }
  }

  // Rule 3: project → current_location_reference_id MUST be non-empty string
  if (sample.current_location_type === "project") {
    if (!sample.current_location_reference_id || typeof sample.current_location_reference_id !== "string") {
      throw new Error("current_location_reference_id must be a non-empty string when current_location_type is project");
    }
  }

  // Rule 4: If checked_out_project_id is set → location must be project and reference_id must match
  if (sample.checked_out_project_id) {
    if (sample.current_location_type !== "project") {
      throw new Error("current_location_type must be 'project' when checked_out_project_id is set");
    }
    if (sample.current_location_reference_id !== sample.checked_out_project_id) {
      throw new Error("current_location_reference_id must equal checked_out_project_id when checked out to a project");
    }
  }

  // Rule 5: If status is retired → all checkout fields must be null
  if (sample.status === "retired") {
    if (
      sample.checked_out_project_id !== null && sample.checked_out_project_id !== undefined ||
      sample.checked_out_by_user_id !== null && sample.checked_out_by_user_id !== undefined ||
      sample.checked_out_at !== null && sample.checked_out_at !== undefined ||
      sample.due_back_at !== null && sample.due_back_at !== undefined
    ) {
      throw new Error("checked_out_project_id, checked_out_by_user_id, checked_out_at, and due_back_at must all be null when status is retired");
    }
  }

  return { success: true };
}