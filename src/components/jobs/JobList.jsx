import React from "react";
import JobCard from "./JobCard";
import { Card, CardContent } from "@/components/ui/card";
import { Timer } from "lucide-react";

export default function JobList({ jobs, isLoading, onSelectJob }) {

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
      {jobs.map((job) => (
        <JobCard 
          key={job.id}
          job={job}
          onClick={() => onSelectJob(job)}
        />
      ))}
    </div>
  );
}