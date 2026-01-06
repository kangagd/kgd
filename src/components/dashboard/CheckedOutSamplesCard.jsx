import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ExternalLink, Clock } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { getSampleStatusColor } from "../domain/sampleConfig";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function CheckedOutSamplesCard() {
  const navigate = useNavigate();

  const { data: checkedOutSamples = [], isLoading } = useQuery({
    queryKey: ['checkedOutSamples'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getMySamples');
      const allSamples = response.data?.samples || [];
      return allSamples.filter(s => s.checked_out_project_id && s.current_location_type === "project");
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projectsForSamples'],
    queryFn: () => base44.entities.Project.list(),
    enabled: checkedOutSamples.length > 0,
  });

  const projectMap = React.useMemo(() => {
    const map = {};
    projects.forEach(p => map[p.id] = p);
    return map;
  }, [projects]);

  const samplesWithOverdue = React.useMemo(() => {
    return checkedOutSamples.map(sample => {
      const daysOut = sample.checked_out_at 
        ? differenceInDays(new Date(), new Date(sample.checked_out_at))
        : 0;
      const isOverdue = daysOut > 7;
      return { ...sample, daysOut, isOverdue };
    });
  }, [checkedOutSamples]);

  const overdueSamples = samplesWithOverdue.filter(s => s.isOverdue);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[18px] flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Checked Out Samples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[#6B7280]">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (checkedOutSamples.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[18px] flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Checked Out Samples
            <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
              {checkedOutSamples.length}
            </Badge>
            {overdueSamples.length > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {overdueSamples.length} overdue
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[#E5E7EB]">
          {samplesWithOverdue.map((sample) => {
            const project = projectMap[sample.checked_out_project_id];
            
            return (
              <div
                key={sample.id}
                className="p-4 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                onClick={() => project && navigate(createPageUrl("Projects") + `?projectId=${project.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-medium text-[#111827]">
                        {sample.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${getSampleStatusColor(sample.status)}`}
                      >
                        {sample.status}
                      </Badge>
                      {sample.isOverdue && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </div>
                    {sample.category && (
                      <p className="text-[12px] text-[#6B7280] mb-1">
                        {sample.category}
                      </p>
                    )}
                    {project && (
                      <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                        <span>Project: {project.title}</span>
                        <span>•</span>
                        <span>{project.customer_name}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-[#9CA3AF] mt-1">
                      Checked out {sample.checked_out_at ? formatDistanceToNow(new Date(sample.checked_out_at), { addSuffix: true }) : 'unknown'}
                      {sample.due_back_at && (
                        <> • Due back {formatDistanceToNow(new Date(sample.due_back_at), { addSuffix: true })}</>
                      )}
                    </p>
                  </div>
                  {project && (
                    <ExternalLink className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}