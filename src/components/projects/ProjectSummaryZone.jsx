import React from "react";
import CollapsibleSection from "../common/CollapsibleSection";
import RichTextField from "../common/RichTextField";

/**
 * ProjectSummaryZone - Collapsible description and notes
 * 
 * Wraps existing description and notes fields in a collapsible section.
 * Does not change editing behavior.
 * 
 * @param {string} description - Description value
 * @param {Function} onDescriptionChange - Description change handler
 * @param {Function} onDescriptionBlur - Description blur handler
 * @param {string} notes - Notes value
 * @param {Function} onNotesChange - Notes change handler
 * @param {Function} onNotesBlur - Notes blur handler
 */
export default function ProjectSummaryZone({ 
  description, 
  onDescriptionChange, 
  onDescriptionBlur,
  notes,
  onNotesChange,
  onNotesBlur
}) {
  return (
    <CollapsibleSection title="Project Summary" defaultCollapsed={true}>
      <div className="space-y-3">
        <RichTextField
          label="Description"
          value={description}
          onChange={onDescriptionChange}
          onBlur={onDescriptionBlur}
          placeholder="Add a clear summary of this project…"
        />

        <RichTextField
          label="Notes"
          value={notes}
          onChange={onNotesChange}
          onBlur={onNotesBlur}
          placeholder="Add any extra notes or context for the team…"
          helperText="Internal only"
        />
      </div>
    </CollapsibleSection>
  );
}