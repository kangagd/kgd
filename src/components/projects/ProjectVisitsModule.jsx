import React from 'react';
import VisitsOverviewBar from './VisitsOverviewBar';
import VisitCard from './VisitCard';

export default function ProjectVisitsModule({ project }) {
  // Use project.jobs and project.jobSummaries if they are passed in
  // This is a placeholder for where the data will come from
  const jobs = project.jobs || [];
  const jobSummaries = project.jobSummaries || [];

  const sortedVisits = [...jobSummaries].sort((a, b) => new Date(b.check_out_time || b.created_date) - new Date(a.check_out_time || a.created_date));

  return (
    <div>
      <VisitsOverviewBar visits={sortedVisits} jobs={jobs} />
      <div className="space-y-4">
        {sortedVisits.map((visit, index) => {
          const job = jobs.find(j => j.id === visit.job_id);
          if (!job) return null;
          return <VisitCard key={visit.id} visit={visit} job={job} index={index} />;
        })}
      </div>
    </div>
  );
}