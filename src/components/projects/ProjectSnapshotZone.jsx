import React from "react";
import { Badge } from "@/components/ui/badge";
import ProjectStageSelector from "./ProjectStageSelector";

const projectTypeColors = {
  "Garage Door Install": "bg-blue-100 text-blue-700",
  "Gate Install": "bg-green-100 text-green-700",
  "Roller Shutter Install": "bg-purple-100 text-purple-700",
  "Multiple": "bg-pink-100 text-pink-700",
  "Motor/Accessory": "bg-cyan-100 text-cyan-700",
  "Repair": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-indigo-100 text-indigo-700"
};

export default function ProjectSnapshotZone({ project }) {
  return (
    <div className="space-y-3">
      {/* Job Type Chip */}
      {project.project_type && (
        <div>
          <Badge className={`${projectTypeColors[project.project_type]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]`}>
            {project.project_type}
          </Badge>
        </div>
      )}

      {/* Current Stage Pills (Read-Only) */}
      <div className="bg-white p-3 rounded-lg border border-[#E5E7EB]">
        <div className="text-[12px] font-medium text-[#4B5563] leading-[1.35] mb-2 uppercase tracking-wide">
          Project Stage
        </div>
        <ProjectStageSelector
          currentStage={project.status}
          onStageChange={undefined}
          onMarkAsLost={undefined}
          disabled={true}
        />
        {project.status === "Lost" && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-[13px] font-medium text-red-700">Lost Reason:</span>
              <span className="text-[13px] text-red-600">
                {project.lost_reason}
                {project.lost_reason_notes && ` - ${project.lost_reason_notes}`}
              </span>
            </div>
            {project.lost_date && (
              <div className="text-[12px] text-red-500 mt-1">
                Lost on {new Date(project.lost_date).toLocaleDateString('en-AU', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}