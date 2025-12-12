import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, User, FileText, Image as ImageIcon, Edit, CheckCircle2, ChevronDown } from "lucide-react";
import RichTextField from "../common/RichTextField";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const jobStatusColors = {
  "Open": "bg-slate-100 text-slate-800",
  "Scheduled": "bg-blue-100 text-blue-800",
  "Completed": "bg-emerald-100 text-emerald-800",
  "Cancelled": "bg-red-100 text-red-800"
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200"
};

export default function ProjectSummary({ project, jobs, onUpdateNotes }) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [summaryNotes, setSummaryNotes] = useState(project.notes || "");

  // Fetch all job summaries for this project
  const { data: allJobSummaries = [] } = useQuery({
    queryKey: ['allProjectJobSummaries', project.id],
    queryFn: async () => {
      const allSummaries = await base44.entities.JobSummary.list('-check_out_time');
      const jobIds = jobs.map(j => j.id);
      return allSummaries.filter(s => jobIds.includes(s.job_id));
    },
    enabled: jobs.length > 0
  });

  const handleSaveNotes = () => {
    if (summaryNotes !== project.notes) {
      onUpdateNotes(summaryNotes);
    }
    setIsEditingNotes(false);
  };

  const completionDate = project.completed_date 
    ? new Date(project.completed_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
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

        {/* Work Performed - All Job Summaries */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <CardTitle className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
              Work Performed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {allJobSummaries.length === 0 ? (
              <p className="text-[14px] text-[#6B7280] leading-[1.4]">No visit summaries recorded</p>
            ) : (
              <div className="space-y-3">
                {allJobSummaries.map((summary) => {
                  const summaryJob = jobs.find(j => j.id === summary.job_id);
                  return (
                    <Collapsible key={summary.id} defaultOpen={false}>
                      <CollapsibleTrigger className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex-1 text-left">
                            <div className="font-bold text-[#000000] mb-1">
                              {summaryJob?.job_type_name || 'Job'} #{summaryJob?.job_number}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {summary.technician_name} • {format(new Date(summary.check_out_time), 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180 flex-shrink-0 ml-2" />
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="pt-3">
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 space-y-2">
                          {summary.outcome && (
                            <Badge className={`${outcomeColors[summary.outcome]} font-semibold border-2 hover:opacity-100`}>
                              {summary.outcome?.replace(/_/g, ' ') || summary.outcome}
                            </Badge>
                          )}

                          {summary.overview && (
                            <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Work Performed:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                            </div>
                          )}

                          {summary.issues_found && (
                            <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Issues Found:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.issues_found }} />
                            </div>
                          )}

                          {summary.resolution && (
                            <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Resolution:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.resolution }} />
                            </div>
                          )}
                          
                          {summary.next_steps && (
                            <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Next Steps:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                            </div>
                          )}
                          
                          {summary.communication_with_client && (
                            <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Communication:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.communication_with_client }} />
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
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
                  onClick={handleSaveNotes}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
                >
                  Save Notes
                </Button>
                <Button
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
                  <Button variant="outline" size="sm" className="flex-shrink-0 h-8">
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