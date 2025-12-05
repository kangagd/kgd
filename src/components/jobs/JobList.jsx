import React from "react";
import JobCard from "./JobCard";
import { Card, CardContent } from "@/components/ui/card";
import { Timer } from "lucide-react";
import { isPast, parseISO, addHours } from "date-fns";
import EntityLink from "../common/EntityLink";
import { createPageUrl } from "@/utils";

export default function JobList({ jobs, isLoading, onSelectJob, onViewDetails, activeCheckInMap = {} }) {

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse rounded-xl">
            <CardContent className="p-4">
              <div className="h-5 bg-[#E5E7EB] rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-[#E5E7EB] rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-[#E5E7EB] rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="p-12 text-center rounded-xl border border-[#E5E7EB]">
        <Timer className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
        <h3 className="text-[16px] font-semibold text-[#111827] mb-2">No jobs found</h3>
        <p className="text-[14px] text-[#6B7280]">Try adjusting your filters</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {jobs.map((job) => {
        // Determine if SLA Highlight needed
        let slaStyle = "";
        if (job.sla_due_at && job.status !== 'Completed') {
          const due = parseISO(job.sla_due_at);
          const now = new Date();
          if (isPast(due)) {
            slaStyle = "ring-2 ring-red-500 bg-red-50";
          } else if (isPast(addHours(now, -1))) { // Logic check: if (due < now + 1h) => isPast(due - 1h)? No.
             // If due is within 1 hour: due < now + 1 hour.
             // due < addHours(now, 1)
             if (due < addHours(now, 1)) {
                slaStyle = "ring-2 ring-yellow-500 bg-yellow-50";
             }
          }
        }

        const activeCheckIns = activeCheckInMap[job.id]?.checkIns || [];
        const hasActiveCheckIn = !!activeCheckInMap[job.id];

        return (
          <EntityLink 
            key={job.id} 
            to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
            className={`block rounded-xl transition-all ${slaStyle}`}
          >
            <JobCard 
              job={job}
              // onClick removed as EntityLink handles it. 
              // If JobCard has internal interactive elements, they should stopPropagation.
              onViewDetails={onViewDetails}
              activeCheckIns={activeCheckIns}
              hasActiveCheckIn={hasActiveCheckIn}
            />
          </EntityLink>
        );
      })}
    </div>
  );
}