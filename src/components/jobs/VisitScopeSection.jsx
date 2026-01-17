import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, CheckCircle, Loader2, Package, Wrench, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getNormalizedPartStatus, PART_STATUS } from "../domain/partConfig";
import ProjectRequirementsPanel from "./ProjectRequirementsPanel";
import ThisVisitCoversPanel from "./ThisVisitCoversPanel";

export default function VisitScopeSection({ job }) {
  // Fetch project data lazily for requirements panel
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['jobProjectForScope', job.project_id],
    queryFn: () => base44.entities.Project.get(job.project_id),
    enabled: !!job.project_id,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: projectParts = [] } = useQuery({
    queryKey: ['projectPartsForScope', job.project_id],
    queryFn: () => base44.entities.Part.filter({ project_id: job.project_id }),
    enabled: !!job.project_id,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: projectTrades = [] } = useQuery({
    queryKey: ['projectTradesForScope', job.project_id],
    queryFn: () => base44.entities.ProjectTradeRequirement.filter({ project_id: job.project_id }),
    enabled: !!job.project_id,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return (
    <div className="space-y-3">
      {/* Project Requirements (Read-only, Collapsible) */}
      <ProjectRequirementsPanel 
        job={job}
        project={project}
        projectParts={projectParts}
        projectTrades={projectTrades}
        isLoading={isProjectLoading}
      />

      {/* This Visit Covers (Editable) */}
      <ThisVisitCoversPanel 
        job={job}
        projectParts={projectParts}
        projectTrades={projectTrades}
        projectRequirements={project?.special_requirements}
      />
    </div>
  );
}