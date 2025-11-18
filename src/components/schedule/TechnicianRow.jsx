import React from "react";

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

export default function TechnicianRow({ technician, jobCount, children }) {
  return (
    <div className="border-b border-[#E5E7EB] bg-white">
      <div className="flex items-center gap-3 p-4">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold text-sm"
          style={{ backgroundColor: '#FAE008' }}
        >
          {getInitials(technician.full_name)}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-[#111827]">{technician.full_name}</p>
          {jobCount !== undefined && (
            <p className="text-xs text-[#4B5563]">{jobCount} {jobCount === 1 ? 'job' : 'jobs'}</p>
          )}
        </div>
      </div>
      {children && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}