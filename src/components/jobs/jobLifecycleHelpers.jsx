export function isLastCheckedInTechnician(checkIns, currentUserEmail) {
  if (!checkIns || checkIns.length === 0 || !currentUserEmail) return false;

  const activeCheckIns = checkIns.filter(c => !c.check_out_time);
  const isCurrentUserCheckedIn = activeCheckIns.some(c => c.technician_email === currentUserEmail);

  return activeCheckIns.length === 1 && isCurrentUserCheckedIn;
}

export async function safeUpdateDraft(base44, jobId, incomingData) {
    const DRAFT_FIELDS = ['measurements', 'image_urls', 'other_documents', 'notes', 'overview', 'issues_found', 'resolution', 'pricing_provided', 'additional_info', 'next_steps', 'communication_with_client', 'completion_notes'];

    const job = await base44.entities.Job.get(jobId);
    let updatePayload = {};

    for (const field of DRAFT_FIELDS) {
        if (field in incomingData) {
            const incomingValue = incomingData[field];
            const existingValue = job[field];

            if (Array.isArray(existingValue)) {
                const newItems = Array.isArray(incomingValue) ? incomingValue : (incomingValue ? [incomingValue] : []);
                if (newItems.length > 0) {
                    const merged = [...existingValue, ...newItems];
                    updatePayload[field] = [...new Set(merged)]; // Dedupe
                }
            } else if (typeof existingValue === 'object' && existingValue !== null) {
                if(incomingValue && Object.keys(incomingValue).length > 0) {
                    updatePayload[field] = { ...existingValue, ...incomingValue }; // Shallow merge
                }
            } else if (incomingValue) { // For text fields, only update if new value is not empty
                updatePayload[field] = incomingValue;
            } else if (incomingValue === null && existingValue) {
                // allow null to clear a field if needed
                updatePayload[field] = null;
            }
        }
    }

    if (Object.keys(updatePayload).length > 0) {
        await base44.entities.Job.update(jobId, updatePayload);
    }
}