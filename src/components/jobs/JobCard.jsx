import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, Clock, ChevronDown, Eye, Truck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { Badge } from "@/components/ui/badge";
import { JobStatusBadge, JobTypeBadge, ProductTypeBadge } from "../common/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DuplicateBadge } from "../common/DuplicateWarningCard";
import FreshnessBadge from "../common/FreshnessBadge";
import { computeSimpleFreshness } from "../utils/computeFreshness";

/* ------------------ query tuning (anti-rate-limit) ------------------ */
const Q = {
  refetchOnWindowFocus: false,
  retry: 1,
  retryDelay: (attempt) => Math.min(1500 * (attempt + 1), 5000),
};
/* ------------------------------------------------------------------- */

function isLogisticsJob(job) {
  const t = `${job?.job_type_name || ""} ${job?.job_type || ""}`.toLowerCase();
  const purpose = `${job?.logistics_purpose || ""}`.toLowerCase();
  return (
    t.includes("delivery") ||
    t.includes("pickup") ||
    t.includes("pick up") ||
    t.includes("return") ||
    t.includes("logistics") ||
    purpose.includes("po_")
  );
}

function isPickupJob(job) {
  const t = `${job?.job_type_name || ""} ${job?.job_type || ""}`.toLowerCase();
  const purpose = `${job?.logistics_purpose || ""}`.toLowerCase();
  return purpose.includes("pickup") || t.includes("pickup") || t.includes("pick up");
}

export default function JobCard({
  job,
  onClick,
  onViewDetails,
  activeCheckIns = [],
  hasActiveCheckIn = false
}) {
  const [user, setUser] = useState(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const freshness = computeSimpleFreshness(job);

  const logistics = useMemo(() => isLogisticsJob(job), [job]);
  const pickup = useMemo(() => isPickupJob(job), [job]);

  // ----- Checklist (NO extra fetch): use job.checked_items if present -----
  const checklistStats = useMemo(() => {
    const checked = job?.checked_items;
    if (!checked || typeof checked !== "object") return null;

    const keys = Object.keys(checked);
    if (keys.length === 0) return null;

    let done = 0;
    for (const k of keys) {
      if (checked[k] === true) done += 1;
    }
    return { total: keys.length, done };
  }, [job?.checked_items]);

  // Trade requirements (only for non-logistics jobs)
  const { data: tradeRequirements = [] } = useQuery({
    queryKey: ["jobTradeRequirements", job?.project_id],
    queryFn: () => base44.entities.ProjectTradeRequirement.filter({ project_id: job.project_id }),
    enabled: !!job?.project_id && !logistics,
    staleTime: 10 * 60 * 1000,
    ...Q,
  });

  const hasRequiredTrades = tradeRequirements.some((t) => t.is_required);

  // Saved jobs (shared per user) – keep cached to avoid refetch spam
  const { data: savedJobs = [] } = useQuery({
    queryKey: ["savedJobs", user?.email],
    queryFn: () => base44.entities.SavedJob.filter({ user_email: user.email }),
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    ...Q,
  });

  const isSaved = savedJobs.some((sj) => sj.job_id === job.id);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) return;

      if (isSaved) {
        const savedJob = savedJobs.find((sj) => sj.job_id === job.id);
        if (savedJob?.id) await base44.entities.SavedJob.delete(savedJob.id);
      } else {
        await base44.entities.SavedJob.create({
          job_id: job.id,
          user_email: user.email,
          user_name: user.full_name
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedJobs", user?.email] });
      toast.success(isSaved ? "Job unsaved" : "Job saved");
    }
  });

  // Latest visit summary – ONLY fetch when user expands
  const { data: latestVisit } = useQuery({
    queryKey: ["latestJobSummary", job.id],
    queryFn: () =>
      base44.entities.JobSummary
        .filter({ job_id: job.id }, "-check_out_time", 1)
        .then((res) => res[0] || null),
    enabled: !!job?.id && visitOpen,
    staleTime: 2 * 60 * 1000,
    ...Q,
  });

  const handlePreview = (e) => {
    e.stopPropagation();
    onViewDetails?.(job);
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative">
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-[#F3F4F6]"
          onClick={handlePreview}
        >
          <Eye className="w-4 h-4 text-[#6B7280]" />
        </Button>
      </div>

      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title + status row */}
          <div>
            <div className="flex items-center justify-between mb-2 pr-8">
              <div className="flex flex-col gap-1">
                {hasActiveCheckIn && (
                  <div className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100 w-fit">
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    In progress
                    {activeCheckIns.length > 0 && activeCheckIns[0]?.technician_name && (
                      <span className="ml-1 font-normal text-emerald-600">
                        · {activeCheckIns[0].technician_name}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                    {job.customer_name}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="pointer-events-none">
                  #{job.job_number}
                </Badge>
                {job.status && <JobStatusBadge value={job.status} className="pointer-events-none" />}
                <FreshnessBadge {...freshness} className="pointer-events-none" />
                <DuplicateBadge record={job} size="sm" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
              <span className="text-[14px] text-[#4B5563] leading-[1.4]">{job.address}</span>
            </div>
          </div>

          {/* Schedule row */}
          <div className="flex items-center gap-4 text-[14px] text-[#4B5563] flex-wrap">
            {job.scheduled_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#6B7280]" />
                <span>{format(parseISO(job.scheduled_date), "MMM d, yyyy")}</span>
              </div>
            )}
            {job.scheduled_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <span>{job.scheduled_time}</span>
              </div>
            )}
          </div>

          {/* Badges + techs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {logistics && (
                <Badge className="bg-slate-800 text-white border-0 flex items-center gap-1 px-2 pointer-events-none">
                  <Truck className="w-3 h-3" />
                  Logistics
                </Badge>
              )}

              {(job.job_type_name || job.job_type) && (
                <JobTypeBadge value={job.job_type_name || job.job_type} className="pointer-events-none" />
              )}

              {job.product && <ProductTypeBadge value={job.product} className="pointer-events-none" />}

              {hasRequiredTrades && !logistics && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 font-medium pointer-events-none">
                  Third-party required
                </span>
              )}

              {/* PICKUP CHECKLIST BADGE (only when pickup + has checklist) */}
              {pickup && checklistStats && (
                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] rounded-md pointer-events-none">
                  Pickup checklist: {checklistStats.done}/{checklistStats.total}
                </Badge>
              )}
            </div>

            {job.assigned_to && job.assigned_to.length > 0 && (
              <TechnicianAvatarGroup
                technicians={job.assigned_to.map((email, idx) => ({
                  email,
                  display_name: job.assigned_to_name?.[idx] || email,
                  full_name: job.assigned_to_name?.[idx] || email,
                  id: email
                }))}
                maxDisplay={3}
                size="sm"
              />
            )}
          </div>

          {/* Latest visit summary (fetch only on open) */}
          <Collapsible
            onClick={(e) => e.stopPropagation()}
            onOpenChange={(open) => setVisitOpen(open)}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors group w-full pt-2 border-t border-[#E5E7EB]">
              <span>Latest Visit Summary</span>
              <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>

            <CollapsibleContent className="pt-2">
              {latestVisit ? (
                <div className="bg-[#F8F9FA] rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-xs text-[#6B7280]">
                    <span>{latestVisit.technician_name}</span>
                    {latestVisit.check_out_time && (
                      <span>{format(new Date(latestVisit.check_out_time), "MMM d, h:mm a")}</span>
                    )}
                  </div>
                  {latestVisit.overview && (
                    <div
                      className="text-[#4B5563] prose prose-sm max-w-none line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: latestVisit.overview }}
                    />
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#6B7280] bg-[#F8F9FA] rounded-lg p-3">
                  No visit summary yet.
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}
