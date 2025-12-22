import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProjectVisitsTab from "./ProjectVisitsTab";
import TasksPanel from "../tasks/TasksPanel";

/**
 * ProjectNextActionsZone - Groups visits and tasks under "What's Next"
 * 
 * Visual grouping only - no changes to internal component behavior.
 * 
 * @param {Object} project - Project entity
 * @param {Array} jobs - Jobs associated with this project
 */
export default function ProjectNextActionsZone({ project, jobs = [] }) {
  if (!project) return null;

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
          What's Next
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Visits Section */}
        <ProjectVisitsTab project={project} jobs={jobs} compact={true} />

        {/* Tasks Section */}
        <TasksPanel
          entityType="project"
          entityId={project.id}
          entityName={project.title}
          compact={true}
        />
      </CardContent>
    </Card>
  );
}