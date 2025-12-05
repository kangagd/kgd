import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, Phone, Mail } from "lucide-react";

export default function JobContactsPanel({ job }) {
  const { data: jobProjectContacts = [], isLoading: jobContactsLoading } = useQuery({
    queryKey: ["project-contacts-for-job", job.project_id],
    queryFn: () =>
      base44.entities.ProjectContact.filter({
        project_id: job.project_id,
        show_on_jobs: true,
      }),
    enabled: !!job?.project_id,
  });

  if (!job?.project_id) return null;

  return (
    <div className="border border-[#E5E7EB] rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-900">
            Contacts for this job
            </h3>
        </div>
      </div>
      
      {jobContactsLoading ? (
        <p className="text-[11px] text-gray-500">Loading contacts…</p>
      ) : !jobProjectContacts?.length ? (
        <p className="text-[11px] text-gray-500 italic">
          No additional contacts.
        </p>
      ) : (
        <div className="space-y-2">
          {jobProjectContacts.map((c) => (
            <div key={c.id} className="text-[11px] bg-gray-50 rounded-lg p-2 border border-gray-100">
              <div className="font-medium text-gray-900 flex items-center justify-between mb-0.5">
                <span>{c.name || "Unnamed contact"}</span>
                {c.role && (
                  <span className="rounded-md bg-[#FAE008]/20 border border-[#FAE008]/30 px-1.5 py-0.5 text-[9px] font-medium text-[#854D0E]">
                    {c.role}
                  </span>
                )}
              </div>
              <div className="text-gray-500 space-y-0.5">
                {c.phone && (
                    <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <a href={`tel:${c.phone}`} className="hover:text-blue-600 hover:underline">{c.phone}</a>
                    </div>
                )}
                {c.email && (
                    <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <a href={`mailto:${c.email}`} className="hover:text-blue-600 hover:underline truncate">{c.email}</a>
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}