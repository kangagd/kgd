import React from "react";
import ProjectEmailSection from "./ProjectEmailSection";
import RichTextField from "../common/RichTextField";

export default function ProjectActivityTab({ 
  project,
  notes,
  setNotes,
  handleNotesBlur,
  onThreadLinked
}) {
  return (
    <div className="space-y-6">
      <ProjectEmailSection 
        project={project}
        onThreadLinked={onThreadLinked}
      />
      
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
  );
}