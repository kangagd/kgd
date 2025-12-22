import React from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import ProjectVisitsTab from "./ProjectVisitsTab";
import TasksPanel from "../tasks/TasksPanel";

export default function ProjectNextActionsZone({ project, jobs }) {
  const [visitsOpen, setVisitsOpen] = React.useState(true);
  const [tasksOpen, setTasksOpen] = React.useState(true);

  return (
    <div className="space-y-3">
      <h2 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
        What's Next
      </h2>

      {/* Visits Section */}
      <div className="border border-[#E5E7EB] rounded-lg bg-white shadow-sm">
        <Collapsible open={visitsOpen} onOpenChange={setVisitsOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
              <h3 className="text-[14px] font-semibold text-[#111827]">Visits</h3>
              <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${visitsOpen ? 'transform rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 border-t border-[#E5E7EB]">
              <ProjectVisitsTab projectId={project.id} jobs={jobs} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Tasks Section */}
      <div className="border border-[#E5E7EB] rounded-lg bg-white shadow-sm">
        <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
              <h3 className="text-[14px] font-semibold text-[#111827]">Tasks</h3>
              <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${tasksOpen ? 'transform rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 border-t border-[#E5E7EB]">
              <TasksPanel
                entityType="project"
                entityId={project.id}
                entityName={project.title}
                compact={true}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}