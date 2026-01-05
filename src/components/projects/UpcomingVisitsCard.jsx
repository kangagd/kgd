import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, Plus, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function UpcomingVisitsCard({ jobs = [], onScheduleVisit }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get upcoming scheduled jobs (max 2)
  const upcomingJobs = jobs
    .filter(j => j.scheduled_date && j.status === "Scheduled")
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .slice(0, 2);

  const handleConfirmationToggle = async (job, checked, e) => {
    e.stopPropagation();
    try {
      // Optimistically update the job in the cache
      queryClient.setQueryData(['projectJobs', job.project_id], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(j => 
          j.id === job.id 
            ? { ...j, client_confirmed: checked, client_confirmed_at: checked ? new Date().toISOString() : null }
            : j
        );
      });

      await base44.entities.Job.update(job.id, {
        client_confirmed: checked,
        client_confirmed_at: checked ? new Date().toISOString() : null
      });
      
      // Only invalidate after successful update
      queryClient.invalidateQueries({ queryKey: ['projectJobs', job.project_id] });
      toast.success(checked ? 'Visit confirmed' : 'Confirmation removed');
    } catch (error) {
      toast.error('Failed to update confirmation');
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['projectJobs', job.project_id] });
    }
  };

  // Check if job is within 24 hours
  const isWithin24Hours = (scheduledDate) => {
    if (!scheduledDate) return false;
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const hoursUntil = (scheduled - now) / (1000 * 60 * 60);
    return hoursUntil >= 0 && hoursUntil <= 24;
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[16px] font-semibold text-[#111827]">Upcoming Visits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingJobs.length === 0 ? (
          <div className="text-center py-4 text-[14px] text-[#9CA3AF]">
            No upcoming visits scheduled
          </div>
        ) : (
          <>
            {upcomingJobs.map((job) => {
              const showWarning = !job.client_confirmed && isWithin24Hours(job.scheduled_date);
              
              return (
                <div
                  key={job.id}
                  className={`pb-3 border-b border-[#E5E7EB] last:border-0 last:pb-0 ${showWarning ? 'bg-red-50 -mx-2 px-2 py-2 rounded-lg border-red-200' : ''}`}
                >
                  {/* Warning Banner */}
                  {showWarning && (
                    <div className="flex items-center gap-2 mb-2 text-red-700 text-[12px] font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Client not confirmed - visit in &lt;24h</span>
                    </div>
                  )}

                  <button
                    onClick={() => navigate(`${createPageUrl("Jobs")}?jobId=${job.id}`)}
                    className="w-full text-left hover:bg-[#F9FAFB] rounded-lg p-2 -m-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-[14px] text-[#111827]">
                        {job.job_type_name || `Job #${job.job_number}`}
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {format(new Date(job.scheduled_date), 'MMM d')}
                      </Badge>
                    </div>
                    {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                      <div className="flex items-center gap-2 text-[13px] text-[#6B7280] mb-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{job.assigned_to_name.join(", ")}</span>
                      </div>
                    )}
                    {job.scheduled_time && (
                      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{job.scheduled_time}</span>
                      </div>
                    )}
                  </button>

                  {/* Client Confirmed Toggle */}
                  <div 
                    className="flex items-center justify-between mt-2 pt-2 border-t border-[#E5E7EB]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      {job.client_confirmed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      )}
                      <span className="text-[13px] font-medium text-[#4B5563]">Client Confirmed</span>
                    </div>
                    <Switch
                      checked={job.client_confirmed || false}
                      onCheckedChange={(checked) => handleConfirmationToggle(job, checked, event)}
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Schedule Visit Button */}
        <Button
          onClick={onScheduleVisit}
          variant="outline"
          size="sm"
          className="w-full text-[13px] h-8 mt-3"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Schedule Visit
        </Button>
      </CardContent>
    </Card>
  );
}