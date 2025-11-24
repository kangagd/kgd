import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  ArrowLeft, MapPin, Phone, Calendar, Clock, User, 
  Sparkles, LogIn, LogOut, Timer, AlertCircle, 
  Navigation, Camera, MessageCircle, ClipboardCheck,
  FileText, ChevronRight, Mail
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import EditableFileUpload from "./EditableFileUpload";
import JobChat from "./JobChat";
import TechnicianAssistant from "./TechnicianAssistant";
import { determineJobStatus } from "./jobStatusHelper";

const statusColors = {
  "Open": "bg-slate-100 text-slate-800",
  "Scheduled": "bg-blue-100 text-blue-800",
  "Completed": "bg-emerald-100 text-emerald-800",
  "Cancelled": "bg-red-100 text-red-800"
};

const outcomeOptions = [
  { value: "completed", label: "✅ Completed" },
  { value: "send_invoice", label: "💰 Send Invoice" },
  { value: "return_visit_required", label: "🔄 Return Visit" },
  { value: "new_quote", label: "📝 New Quote" },
  { value: "update_quote", label: "📝 Update Quote" }
];

export default function TechnicianMobileJobView({ job: initialJob, onClose, user }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [showAssistant, setShowAssistant] = useState(false);
  
  // Visit form state
  const [overview, setOverview] = useState(initialJob.overview || "");
  const [nextSteps, setNextSteps] = useState(initialJob.next_steps || "");
  const [communication, setCommunication] = useState(initialJob.communication_with_client || "");
  const [outcome, setOutcome] = useState(initialJob.outcome || "");
  const [validationError, setValidationError] = useState("");

  const { data: job = initialJob } = useQuery({
    queryKey: ['job', initialJob.id],
    queryFn: () => base44.entities.Job.get(initialJob.id),
    initialData: initialJob
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkIns', job.id],
    queryFn: () => base44.entities.CheckInOut.filter({ job_id: job.id })
  });

  const activeCheckIn = checkIns.find(c => !c.check_out_time && c.technician_email === user?.email);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const checkIn = await base44.entities.CheckInOut.create({
        job_id: job.id,
        technician_email: user.email,
        technician_name: user.full_name,
        check_in_time: new Date().toISOString()
      });
      const newStatus = determineJobStatus(job.scheduled_date, job.outcome, true, job.status);
      await base44.entities.Job.update(job.id, { status: newStatus });
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success("Checked in successfully");
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const checkOutTime = new Date().toISOString();
      const checkInTime = new Date(activeCheckIn.check_in_time);
      const durationHours = (new Date(checkOutTime) - checkInTime) / (1000 * 60 * 60);
      const durationMinutes = Math.round(durationHours * 60);
      const isMistake = durationMinutes < 1;

      if (!isMistake) {
        if (!overview || !nextSteps || !communication || !outcome) {
          throw new Error("Please complete all visit fields before checking out.");
        }
        if (!job.image_urls || job.image_urls.length === 0) {
          throw new Error("Please upload at least one photo before checking out.");
        }
      }

      const newStatus = isMistake ? job.status : determineJobStatus(job.scheduled_date, outcome, false, job.status);

      if (!isMistake) {
        await base44.entities.JobSummary.create({
          job_id: job.id,
          project_id: job.project_id || null,
          job_number: job.job_number,
          job_type: job.job_type_name || null,
          technician_email: user.email,
          technician_name: user.full_name,
          check_in_time: activeCheckIn.check_in_time,
          check_out_time: checkOutTime,
          duration_minutes: durationMinutes,
          overview,
          next_steps: nextSteps,
          communication_with_client: communication,
          outcome,
          status_at_checkout: newStatus,
          photo_urls: job.image_urls || []
        });
      }

      await base44.entities.CheckInOut.update(activeCheckIn.id, {
        check_out_time: checkOutTime,
        duration_hours: Math.round(durationHours * 10) / 10
      });

      await base44.entities.Job.update(job.id, {
        overview,
        next_steps: nextSteps,
        communication_with_client: communication,
        outcome,
        status: newStatus
      });
    },
    onSuccess: () => {
      setValidationError("");
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success("Checked out successfully");
    },
    onError: (error) => {
      setValidationError(error.message);
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Job.update(job.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    }
  });

  const handleImagesChange = async (urls) => {
    updateJobMutation.mutate({ field: 'image_urls', value: urls });
    
    const existingUrls = job.image_urls || [];
    const newUrls = Array.isArray(urls) ? urls.filter(url => !existingUrls.includes(url)) : [];
    
    if (newUrls.length > 0 && user) {
      for (const url of newUrls) {
        try {
          await base44.entities.Photo.create({
            image_url: url,
            job_id: job.id,
            job_number: job.job_number,
            customer_id: job.customer_id,
            customer_name: job.customer_name,
            address: job.address,
            uploaded_at: new Date().toISOString(),
            technician_email: user.email,
            technician_name: user.full_name
          });
        } catch (error) {
          console.error('Failed to create photo record:', error);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-40 safe-area-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-bold text-[#111827] truncate">{job.customer_name}</h1>
              <Badge className="bg-[#F3F4F6] text-[#6B7280] text-[11px] px-1.5 py-0.5">
                #{job.job_number}
              </Badge>
            </div>
            <p className="text-[12px] text-[#6B7280] truncate">{job.job_type_name || 'Job'}</p>
          </div>
          <Badge className={`${statusColors[job.status]} text-[11px] px-2 py-1`}>
            {job.status}
          </Badge>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white border-b border-[#E5E7EB] px-3 py-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
            className="flex-1 h-10 gap-1.5 text-[13px] font-medium"
          >
            <Navigation className="w-4 h-4 text-green-600" />
            Navigate
          </Button>
          {job.customer_phone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `tel:${job.customer_phone}`}
              className="flex-1 h-10 gap-1.5 text-[13px] font-medium"
            >
              <Phone className="w-4 h-4 text-blue-600" />
              Call
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAssistant(true)}
            className="h-10 w-10 p-0"
          >
            <Sparkles className="w-4 h-4 text-[#111827]" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="bg-white border-b border-[#E5E7EB] px-2">
          <TabsList className="w-full h-12 bg-transparent gap-0 p-0">
            <TabsTrigger value="details" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#FAE008] data-[state=active]:bg-transparent text-[13px]">
              Details
            </TabsTrigger>
            <TabsTrigger value="visit" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#FAE008] data-[state=active]:bg-transparent text-[13px]">
              Visit
            </TabsTrigger>
            <TabsTrigger value="files" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#FAE008] data-[state=active]:bg-transparent text-[13px]">
              Files
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#FAE008] data-[state=active]:bg-transparent text-[13px]">
              Chat
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto pb-28">
          {/* Details Tab */}
          <TabsContent value="details" className="m-0 p-4 space-y-3">
            {/* Address Card */}
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-medium mb-0.5">Address</p>
                    <p className="text-[14px] text-[#111827] font-medium leading-snug">{job.address}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Contact Card */}
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-3 space-y-3">
                {job.customer_phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-medium mb-0.5">Phone</p>
                      <a href={`tel:${job.customer_phone}`} className="text-[14px] text-[#111827] font-medium">
                        {job.customer_phone}
                      </a>
                    </div>
                  </div>
                )}
                {job.customer_email && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-medium mb-0.5">Email</p>
                      <p className="text-[14px] text-[#111827] font-medium truncate">{job.customer_email}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Card */}
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-medium mb-0.5">Schedule</p>
                    <p className="text-[14px] text-[#111827] font-medium">
                      {job.scheduled_date ? format(parseISO(job.scheduled_date), 'EEE, MMM d') : 'Not scheduled'}
                      {job.scheduled_time && ` at ${job.scheduled_time}`}
                    </p>
                  </div>
                  {job.expected_duration && (
                    <Badge variant="outline" className="text-[12px]">
                      <Timer className="w-3 h-3 mr-1" />
                      {job.expected_duration}h
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notes Card */}
            {job.notes && (
              <Card className="border border-[#E5E7EB]">
                <CardContent className="p-3">
                  <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-medium mb-2">Job Notes</p>
                  <div 
                    className="text-[14px] text-[#111827] leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: job.notes }}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Visit Tab */}
          <TabsContent value="visit" className="m-0 p-4 space-y-4">
            {activeCheckIn && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-600" />
                <span className="text-[13px] text-blue-700 font-medium">
                  Checked in at {format(new Date(activeCheckIn.check_in_time), 'h:mm a')}
                </span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[13px] font-medium text-[#4B5563] mb-1.5 block">
                  Overview <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  placeholder="What was done during this visit..."
                  className="min-h-[80px] text-[15px] resize-none"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-[#4B5563] mb-1.5 block">
                  Next Steps <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  placeholder="What needs to happen next..."
                  className="min-h-[80px] text-[15px] resize-none"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-[#4B5563] mb-1.5 block">
                  Client Communication <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={communication}
                  onChange={(e) => setCommunication(e.target.value)}
                  placeholder="What was discussed with the client..."
                  className="min-h-[80px] text-[15px] resize-none"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-[#4B5563] mb-1.5 block">
                  Outcome <span className="text-red-500">*</span>
                </label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger className="h-12 text-[15px]">
                    <SelectValue placeholder="Select outcome..." />
                  </SelectTrigger>
                  <SelectContent>
                    {outcomeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-[15px]">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {validationError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="text-[13px] text-red-700">{validationError}</span>
              </div>
            )}
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="m-0 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-medium text-[#4B5563] mb-2">Photos & Videos</p>
                <EditableFileUpload
                  files={job.image_urls || []}
                  onFilesChange={handleImagesChange}
                  accept="image/*,video/*"
                  multiple={true}
                  icon={Camera}
                  label=""
                  emptyText="Tap to upload photos"
                />
              </div>
              
              {job.other_documents && job.other_documents.length > 0 && (
                <div>
                  <p className="text-[13px] font-medium text-[#4B5563] mb-2">Documents</p>
                  <div className="space-y-2">
                    {job.other_documents.map((doc, idx) => (
                      <a 
                        key={idx} 
                        href={doc} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"
                      >
                        <FileText className="w-4 h-4 text-[#6B7280]" />
                        <span className="text-[13px] text-[#111827] truncate">Document {idx + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="m-0 p-4">
            <JobChat jobId={job.id} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-3 safe-area-bottom z-50">
        <div className="flex gap-2">
          {!activeCheckIn ? (
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="flex-1 h-12 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold text-[15px] rounded-xl"
            >
              <LogIn className="w-5 h-5 mr-2" />
              {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
            </Button>
          ) : (
            <Button
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] rounded-xl"
            >
              <LogOut className="w-5 h-5 mr-2" />
              {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
            </Button>
          )}
        </div>
      </div>

      {/* AI Assistant */}
      <TechnicianAssistant
        open={showAssistant}
        onClose={() => setShowAssistant(false)}
        job={job}
      />
    </div>
  );
}