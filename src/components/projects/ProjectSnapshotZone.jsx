import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const projectTypeColors = {
  "Garage Door Install": "bg-blue-100 text-blue-700",
  "Gate Install": "bg-green-100 text-green-700",
  "Roller Shutter Install": "bg-purple-100 text-purple-700",
  "Multiple": "bg-pink-100 text-pink-700",
  "Motor/Accessory": "bg-cyan-100 text-cyan-700",
  "Repair": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-indigo-100 text-indigo-700"
};

const statusColors = {
  "Lead": "bg-slate-100 text-slate-700",
  "Initial Site Visit": "bg-blue-100 text-blue-700",
  "Create Quote": "bg-violet-100 text-violet-700",
  "Quote Sent": "bg-purple-100 text-purple-700",
  "Quote Approved": "bg-indigo-100 text-indigo-700",
  "Final Measure": "bg-cyan-100 text-cyan-700",
  "Parts Ordered": "bg-amber-100 text-amber-700",
  "Scheduled": "bg-blue-100 text-blue-700",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Warranty": "bg-red-100 text-red-700",
  "Lost": "bg-red-100 text-red-700"
};

/**
 * ProjectSnapshotZone - Read-only status at a glance
 * 
 * Displays key project indicators:
 * - Project type
 * - Current stage
 * 
 * @param {Object} project - Project entity
 */
export default function ProjectSnapshotZone({ project }) {
  if (!project) return null;

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
          Status at a Glance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3">
          {/* Project Type */}
          {project.project_type && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-[#6B7280]">Type</span>
              <Badge className={`${projectTypeColors[project.project_type]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]`}>
                {project.project_type}
              </Badge>
            </div>
          )}

          {/* Current Stage */}
          {project.status && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-[#6B7280]">Stage</span>
              <Badge className={`${statusColors[project.status]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]`}>
                {project.status}
              </Badge>
            </div>
          )}

          {/* Contract Indicator */}
          {project.contract_id && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-[#6B7280]">Type</span>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-medium text-[12px] leading-[1.35] px-2.5 py-0.5 rounded-lg">
                Contract Job
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}