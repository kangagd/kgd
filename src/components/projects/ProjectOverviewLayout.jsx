import React from "react";
import ProjectSnapshotZone from "./ProjectSnapshotZone";
import AttentionItemsPanel from "../attention/AttentionItemsPanel";
import ProjectNextActionsZone from "./ProjectNextActionsZone";
import ProjectSummaryZone from "./ProjectSummaryZone";

export default function ProjectOverviewLayout({ 
  project,
  parts,
  jobs,
  description,
  notes,
  onDescriptionChange,
  onNotesChange,
  onDescriptionBlur,
  onNotesBlur,
  onAddJob,
  onJobClick,
  onPreviewJob,
  canCreateJobs
}) {
  return (
    <div className="space-y-4">
      {/* ZONE 1: Project Snapshot */}
      <ProjectSnapshotZone project={project} parts={parts} jobs={jobs} />

      {/* ZONE 2: Attention Items */}
      <AttentionItemsPanel
        entity_type="project"
        entity_id={project.id}
        context_ids={{
          customer_id: project.customer_id,
          project_id: project.id,
          job_id: null
        }}
      />

      {/* ZONE 3: What's Next - Combined Tasks & Visits */}
      <ProjectNextActionsZone
        project={project}
        jobs={jobs}
        onAddJob={onAddJob}
        onJobClick={onJobClick}
        onPreviewJob={onPreviewJob}
        canCreateJobs={canCreateJobs}
      />

      {/* ZONE 4: Project Summary - Description & Notes */}
      <ProjectSummaryZone
        description={description}
        notes={notes}
        onDescriptionChange={onDescriptionChange}
        onNotesChange={onNotesChange}
        onDescriptionBlur={onDescriptionBlur}
        onNotesBlur={onNotesBlur}
      />
    </div>
  );
}