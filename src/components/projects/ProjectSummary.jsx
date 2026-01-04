import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, User, FileText, Image as ImageIcon, Edit, CheckCircle2 } from "lucide-react";
import RichTextField from "../common/RichTextField";

const jobStatusColors = {
  "Open": "bg-slate-100 text-slate-800",
  "Scheduled": "bg-blue-100 text-blue-800",
  "Completed": "bg-emerald-100 text-emerald-800",
  "Cancelled": "bg-red-100 text-red-800"
};

export default function ProjectSummary({ project, jobs, onUpdateNotes }) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [summaryNotes, setSummaryNotes] = useState(project.notes || "");

  const handleSaveNotes = () => {
    if (summaryNotes !== project.notes) {
      onUpdateNotes(summaryNotes);
    }
    setIsEditingNotes(false);
  };

  const parseCompletedDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Handle DD/MM/YYYY format (e.g., "29/4/2025")
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    // Try standard date parsing
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const completedDateObj = parseCompletedDate(project.completed_date);
  const completionDate = completedDateObj
    ? completedDateObj.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : project.status === "Completed" && project.updated_date
    ? new Date(project.updated_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : "N/A";

  const primaryTechnician = project.assigned_technicians_names?.[0] || "Not assigned";

  const allAttachments = [
    ...(project.image_urls || []).map(url => ({ url, type: 'image', name: 'Project Photo' })),
    ...(project.quote_url ? [{ url: project.quote_url, type: 'document', name: 'Quote Document' }] : []),
    ...(project.invoice_url ? [{ url: project.invoice_url, type: 'document', name: 'Invoice Document' }] : []),
    ...(project.quote_attachments || []).map((url, i) => ({ url, type: 'document', name: `Quote Attachment ${i + 1}` }))
  ];

  return (
    <div className="space-y-4">
      {/* Desktop 2-column layout, Mobile single column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Project at a Glance */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <CardTitle className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
              Project at a Glance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-1 uppercase tracking-wide">Project Name</div>
              <div className="text-[16px] font-semibold text-[#111827] leading-[1.4]">{project.title}</div>
            </div>

            <div>
              <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-1 uppercase tracking-wide">Status</div>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 font-medium px-2.5 py-0.5 text-[12px] leading-[1.35] rounded-lg">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {project.status}
              </Badge>
            </div>

            <div>
              <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-1 uppercase tracking-wide">Customer</div>
              <div className="text-[14px] font-medium text-[#111827] leading-[1.4]">{project.customer_name}</div>
            </div>

            {project.address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5 uppercase tracking-wide">Site Address</div>
                  <div className="text-[14px] text-[#111827] leading-[1.4]">{project.address}</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5 uppercase tracking-wide">Primary Technician</div>
                <div className="text-[14px] text-[#111827] leading-[1.4]">{primaryTechnician}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5 uppercase tracking-wide">Completed On</div>
                <div className="text-[14px] text-[#111827] leading-[1.4]">{completionDate}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Performed */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <CardTitle className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
              Work Performed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {jobs.length === 0 ? (
              <p className="text-[14px] text-[#6B7280] leading-[1.4]">No visits recorded</p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E5E7EB]">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-white text-[#6B7280] hover:bg-white border border-[#E5E7EB] font-medium text-[12px] leading-[1.35] px-2.5 py-0.5 rounded-lg">
                          #{job.job_number}
                        </Badge>
                        <Badge className={`${jobStatusColors[job.status]} hover:${jobStatusColors[job.status]} border-0 font-medium text-[12px] leading-[1.35] px-2.5 py-0.5 rounded-lg`}>
                          {job.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      {job.job_type_name && (
                        <div className="text-[14px] font-medium text-[#111827] leading-[1.4]">{job.job_type_name}</div>
                      )}
                      {job.scheduled_date && (
                        <div className="text-[12px] text-[#6B7280] leading-[1.35]">
                          {new Date(job.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {job.scheduled_time && ` • ${job.scheduled_time}`}
                        </div>
                      )}
                      {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                        <div className="text-[12px] text-[#6B7280] leading-[1.35]">
                          Technician: {job.assigned_to_name.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Final Notes & Outcomes - Full width */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
              Final Notes & Outcomes
            </CardTitle>
            {!isEditingNotes && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditingNotes(true)}
                className="h-8"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isEditingNotes ? (
            <div className="space-y-3">
              <RichTextField
                value={summaryNotes}
                onChange={setSummaryNotes}
                placeholder="Add final notes, outcomes, and important comments..."
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleSaveNotes}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
                >
                  Save Notes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSummaryNotes(project.notes || "");
                    setIsEditingNotes(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-[14px] text-[#111827] leading-[1.4]">
              {project.notes ? (
                <div dangerouslySetInnerHTML={{ __html: project.notes }} />
              ) : (
                <p className="text-[#6B7280] italic">No final notes recorded</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments & Evidence - Full width */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
          <CardTitle className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
            Attachments & Evidence
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {allAttachments.length === 0 ? (
            <p className="text-[14px] text-[#6B7280] leading-[1.4]">No attachments available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allAttachments.map((attachment, index) => (
                <a
                  key={index}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:shadow-sm transition-all"
                >
                  {attachment.type === 'image' ? (
                    <div className="flex-shrink-0">
                      <img 
                        src={attachment.url} 
                        alt={attachment.name}
                        className="w-12 h-12 object-cover rounded border border-[#E5E7EB]"
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-[#F8F9FA] rounded flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[#6B7280]" />
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[#111827] leading-[1.4] truncate">
                      {attachment.name}
                    </div>
                    <div className="text-[12px] text-[#6B7280] leading-[1.35]">
                      {attachment.type === 'image' ? 'Image' : 'Document'}
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="flex-shrink-0 h-8">
                    Open
                  </Button>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}