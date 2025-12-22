import React from "react";
import CollapsibleSection from "../common/CollapsibleSection";
import RichTextField from "../common/RichTextField";

export default function ProjectSummaryZone({ 
  description, 
  setDescription, 
  handleDescriptionBlur,
  notes,
  setNotes,
  handleNotesBlur
}) {
  return (
    <CollapsibleSection title="Project Summary" defaultCollapsed={true}>
      <div className="space-y-3">
        <div>
          <RichTextField
            label="Description"
            value={description}
            onChange={setDescription}
            onBlur={handleDescriptionBlur}
            placeholder="Add a clear summary of this project…"
          />
        </div>

        <div>
          <RichTextField
            label="Notes"
            value={notes}
            onChange={setNotes}
            onBlur={handleNotesBlur}
            placeholder="Add any extra notes or context for the team…"
            helperText="Internal only"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}