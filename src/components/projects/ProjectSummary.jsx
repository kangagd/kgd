import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Edit, MapPin, User, Calendar, ExternalLink, FileText, Image as ImageIcon, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ProjectStatusBadge } from "../common/StatusBadge";

export default function ProjectSummary({ project }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesBuffer, setNotesBuffer] = useState("");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  // Queries
  const { data: jobSummaries = [], isLoading: loadingSummaries } = useQuery({
    queryKey: ['projectJobSummaries', project.id],
    queryFn: () => base44.entities.JobSummary.filter({ project_id: project.id }, '-check_out_time')
  });

  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ['projectPhotos', project.id],
    queryFn: () => base44.entities.Photo.filter({ project_id: project.id }, 'created_at')
  });

  // Mutation for notes
  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['project', project.id]);
      setIsEditingNotes(false);
      toast.success("Final notes updated");
    }
  });

  const handleSaveNotes = () => {
    updateProjectMutation.mutate({ notes: notesBuffer });
  };

  const startEditing = () => {
    setNotesBuffer(project.notes || "");
    setIsEditingNotes(true);
  };

  // Derived display values
  const primaryTechnician = project.assigned_technicians_names?.[0] || "Not assigned";
  const completedDate = project.completed_date 
    ? format(parseISO(project.completed_date), 'd MMM yyyy') 
    : "N/A";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project at a Glance */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-xl h-full">
          <CardHeader className="bg-slate-50 px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-base font-bold text-[#111827]">Project at a Glance</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div>
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">PROJECT NAME</div>
              <div className="text-[15px] font-medium text-[#111827]">{project.title}</div>
            </div>
            
            <div>
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">STATUS</div>
              <ProjectStatusBadge value={project.status} className="text-xs" />
            </div>

            <div>
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">CUSTOMER</div>
              <div className="text-[14px] text-[#111827]">{project.customer_name || "N/A"}</div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">SITE ADDRESS</div>
              <div className="text-[14px] text-[#111827] flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-[#9CA3AF] mt-0.5 flex-shrink-0" />
                {project.address_full || project.address || "N/A"}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">PRIMARY TECHNICIAN</div>
              <div className="text-[14px] text-[#111827] flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#9CA3AF]" />
                {primaryTechnician}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">COMPLETED ON</div>
              <div className="text-[14px] text-[#111827] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#9CA3AF]" />
                {completedDate}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Performed */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-xl h-full">
          <CardHeader className="bg-slate-50 px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-base font-bold text-[#111827]">Work Performed</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loadingSummaries ? (
              <div className="text-sm text-slate-400 italic">Loading visits...</div>
            ) : jobSummaries.length === 0 ? (
              <div className="text-center py-10">
                <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No visits recorded</p>
              </div>
            ) : (
              <div className="space-y-0">
                {jobSummaries.map((summary, index) => {
                  const visitDate = summary.scheduled_datetime || summary.check_in_time;
                  return (
                    <div key={summary.id || index} className={`flex flex-col sm:flex-row gap-4 py-4 ${index !== jobSummaries.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="sm:w-40 flex-shrink-0">
                        <div className="text-[14px] font-semibold text-[#111827]">
                          {visitDate ? format(parseISO(visitDate), 'EEE, d MMM yyyy') : 'Date N/A'}
                        </div>
                        <div className="text-[12px] text-[#6B7280] mt-0.5">
                          {summary.job_type} • #{summary.job_number}
                        </div>
                        {summary.technician_name && (
                          <div className="text-[12px] text-[#9CA3AF] mt-0.5">
                            {summary.technician_name}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] text-[#374151] leading-relaxed">
                          {summary.overview || "No overview recorded."}
                        </p>
                        {summary.outcome && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal text-[11px]">
                              Outcome: {summary.outcome}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Final Notes & Outcomes */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
        <CardHeader className="bg-slate-50 px-6 py-4 border-b border-[#E5E7EB] flex flex-row justify-between items-center">
          <CardTitle className="text-base font-bold text-[#111827]">Final Notes & Outcomes</CardTitle>
          {isAdminOrManager && !isEditingNotes && (
            <Button variant="ghost" size="sm" onClick={startEditing} className="h-8 px-2 text-slate-600 hover:text-[#111827]">
              <Edit className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {isEditingNotes ? (
            <div className="space-y-3">
              <Textarea 
                value={notesBuffer}
                onChange={(e) => setNotesBuffer(e.target.value)}
                className="min-h-[150px] text-sm"
                placeholder="Enter final notes..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditingNotes(false)}>Cancel</Button>
                <Button onClick={handleSaveNotes} className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]">Save</Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-[#374151]">
              {project.notes ? (
                <div className="whitespace-pre-wrap">{project.notes}</div>
              ) : (
                <p className="text-slate-400 italic">No final notes recorded yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments & Evidence */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
        <CardHeader className="bg-slate-50 px-6 py-4 border-b border-[#E5E7EB]">
          <CardTitle className="text-base font-bold text-[#111827]">Attachments & Evidence</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loadingPhotos ? (
            <div className="text-sm text-slate-400 italic">Loading attachments...</div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No attachments added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-lg hover:bg-slate-50 transition-colors bg-white">
                  <div className="w-12 h-12 rounded bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200 flex items-center justify-center">
                    {photo.thumbnail_url || photo.url ? (
                      <img src={photo.thumbnail_url || photo.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#111827] truncate" title={photo.file_name || "Attachment"}>
                      {photo.file_name || "Attachment"}
                    </div>
                    <div className="text-[11px] text-[#6B7280]">
                      {photo.file_type || "Image"} • {new Date(photo.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 flex-shrink-0 text-slate-500 hover:text-[#111827]"
                    onClick={() => window.open(photo.url, "_blank")}
                    title="Open"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}