import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, Phone, Navigation, User, CheckCircle2, Circle, Edit2, X, Check, FileText, Loader2, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { createPageUrl } from "@/utils";
import AttentionItemsPanel from "../attention/AttentionItemsPanel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { normalizeJob } from "@/components/utils/normalizeJob";
import { resolveTechnicianDisplayName } from "@/components/utils/technicianDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusColors = {
  "Open": "bg-slate-100 text-slate-700",
  "Scheduled": "bg-[#fae008] text-[#92400E]",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Cancelled": "bg-red-100 text-red-700"
};

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700"
};

export default function JobModalView({ job, onJobUpdated }) {
  const normalized = normalizeJob(job);
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    scheduled_date: normalized.scheduled_date || '',
    scheduled_time: normalized.scheduled_time || '',
    assigned_to: normalized.assigned_to || []
  });
  const [techniciansSearch, setTechniciansSearch] = useState('');
  const queryClient = useQueryClient();
  
  // Job Brief state
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [briefText, setBriefText] = useState(job.job_brief || '');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const didAutoBriefRef = useRef(false);

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: isEditing
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke('manageJob', { action: 'update', id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job updated');
      setIsEditing(false);
      onJobUpdated?.();
    }
  });

  const saveBriefMutation = useMutation({
    mutationFn: async (briefData) => {
      return await base44.entities.Job.update(job.id, briefData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job brief saved');
      setIsEditingBrief(false);
      onJobUpdated?.();
    }
  });

  const generateBriefMutation = useMutation({
    mutationFn: async ({ mode }) => {
      const response = await base44.functions.invoke('generateJobBrief', {
        job_id: job.id,
        mode
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.skipped) {
        toast.info(`Job brief not generated: ${data.reason}`);
      } else {
        setBriefText(data.job_brief);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        toast.success('Job brief generated');
        onJobUpdated?.();
      }
    },
    onError: (error) => {
      toast.error('Failed to generate job brief');
    }
  });

  // Auto-generate brief on modal open (only once)
  useEffect(() => {
    if (!didAutoBriefRef.current && job.id && !isEditingBrief) {
      didAutoBriefRef.current = true;
      generateBriefMutation.mutate({ mode: 'auto' });
    }
  }, [job.id]);

  // Update local state when job changes
  useEffect(() => {
    setBriefText(job.job_brief || '');
  }, [job.job_brief]);

  const handleCall = () => {
    if (job.customer_phone) {
      window.location.href = `tel:${job.customer_phone}`;
    }
  };

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(normalized.address_display)}&travelmode=driving`, '_blank');
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: job.id,
      data: editData
    });
  };

  const handleSaveBrief = () => {
    saveBriefMutation.mutate({
      job_brief: briefText,
      job_brief_source: 'manual',
      job_brief_locked: true
    });
  };

  const handleRegenerateBrief = () => {
    setIsGeneratingBrief(true);
    generateBriefMutation.mutate({ mode: 'force' });
    setIsGeneratingBrief(false);
  };

  return (
    <div className="space-y-4">
      {/* Attention Items Panel */}
      <AttentionItemsPanel
        entity_type="job"
        entity_id={job.id}
        context_ids={{
          customer_id: job.customer_id,
          project_id: job.project_id,
          job_id: job.id
        }}
      />

      {/* Job Brief Card */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6B7280]" />
              <CardTitle className="text-[16px] font-semibold text-[#111827]">Job Brief</CardTitle>
              {job.job_brief_source === 'manual' && (
                <Badge variant="outline" className="text-[10px] px-2 py-0">
                  Manual
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isEditingBrief && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsEditingBrief(true)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={generateBriefMutation.isPending}
                      >
                        {generateBriefMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate Job Brief?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will replace your current Job Brief with a new AI-generated version. Continue?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerateBrief}>
                          Regenerate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingBrief ? (
            <div className="space-y-3">
              <Textarea
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                placeholder="Enter job brief..."
                className="min-h-[150px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveBrief}
                  disabled={saveBriefMutation.isPending}
                  size="sm"
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setIsEditingBrief(false);
                    setBriefText(job.job_brief || '');
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-[14px] text-[#111827] whitespace-pre-wrap">
              {briefText || (
                <div className="text-center py-6 text-[#9CA3AF]">
                  {generateBriefMutation.isPending ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating brief...</span>
                    </div>
                  ) : (
                    'No job brief yet. Click the edit button to add one or wait for auto-generation.'
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {normalized.project_label && (
              <button
                onClick={() => job.project_id && navigate(createPageUrl("Projects") + `?projectId=${job.project_id}`)}
                className="bg-[#DDD6FE] text-[#5B21B6] border-0 font-medium text-xs px-2.5 py-0.5 rounded-lg hover:bg-[#CDD5FE] transition-colors cursor-pointer"
              >
                {normalized.project_label}
              </button>
            )}
            {job.job_type_name && (
              <Badge className="bg-[#EDE9FE] text-[#6D28D9] border-0 font-medium text-xs px-2.5 py-0.5 rounded-lg">
                {job.job_type_name}
              </Badge>
            )}
            {job.product && (
              <Badge className={`${productColors[job.product]} font-medium text-xs px-2.5 py-0.5 rounded-lg border-0`}>
                {job.product}
              </Badge>
            )}
            {job.client_confirmed ? (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmed
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                <Circle className="w-3.5 h-3.5" />
                Awaiting Confirmation
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            {job.status && (
              <Badge className={`${statusColors[job.status]} font-medium px-2.5 py-0.5 rounded-lg border-0`}>
                {job.status}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            {normalized.customer_name}
          </h3>
          {normalized.project_label && (
            <Badge className="bg-blue-100 text-blue-700 border-0 font-medium text-sm px-2.5 py-0.5 rounded-lg">
              {normalized.project_label}
            </Badge>
          )}
        </div>

        {/* Schedule Info */}
        {!isEditing && normalized.scheduled_date && (
          <div className="flex items-center gap-4 text-[14px] text-[#4B5563] flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#6B7280]" />
              <span>{format(parseISO(normalized.scheduled_date), 'MMM d, yyyy')}</span>
            </div>
            {normalized.scheduled_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <span>{normalized.scheduled_time}</span>
              </div>
            )}
            {normalized.assigned_to && normalized.assigned_to.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#6B7280] font-medium">Assigned to:</span>
                <div className="flex items-center gap-1 text-xs text-[#4B5563]">
                  {technicians.map((tech, idx) => {
                    const email = normalized.assigned_to[idx];
                    if (!email) return null;
                    const displayName = resolveTechnicianDisplayName(tech);
                    return (
                      <span key={email}>
                        {displayName}
                        {idx < normalized.assigned_to.length - 1 ? ', ' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Mode - Schedule Form */}
        {isEditing && (
          <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#111827]">Edit Schedule</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    scheduled_date: job.scheduled_date || '',
                    scheduled_time: job.scheduled_time || '',
                    assigned_to: job.assigned_to || []
                  });
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div>
              <label className="text-xs font-medium text-[#6B7280] block mb-1">Date</label>
              <Input
                type="date"
                value={editData.scheduled_date}
                onChange={(e) => setEditData({ ...editData, scheduled_date: e.target.value })}
                className="h-9"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#6B7280] block mb-1">Time</label>
              <Input
                type="time"
                value={editData.scheduled_time}
                onChange={(e) => setEditData({ ...editData, scheduled_time: e.target.value })}
                className="h-9"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#6B7280] block mb-1">Assigned Technicians</label>
              <Select
                value={editData.assigned_to?.[0] || ''}
                onValueChange={(email) => {
                  setEditData({ ...editData, assigned_to: [email] });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.email}>
                      {resolveTechnicianDisplayName(tech)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex-1 h-8 gap-2"
                size="sm"
              >
                <Check className="w-4 h-4" />
                Save
              </Button>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    scheduled_date: job.scheduled_date || '',
                    scheduled_time: job.scheduled_time || '',
                    assigned_to: job.assigned_to || []
                  });
                }}
                variant="outline"
                className="flex-1 h-8"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Address */}
      {normalized.address_display && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <MapPin className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Address</div>
            <div className="text-[14px] text-[#111827]">{normalized.address_display}</div>
          </div>
        </div>
      )}

      {/* Contact */}
      {job.customer_phone && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Phone className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Phone</div>
            <div className="text-[14px] text-[#111827]">{job.customer_phone}</div>
          </div>
        </div>
      )}



      {/* Quick Actions */}
      <div className="flex gap-2 pt-2">
        {job.customer_phone && (
          <Button
            onClick={handleCall}
            variant="outline"
            className="flex-1 gap-2"
          >
            <Phone className="w-4 h-4" />
            Call
          </Button>
        )}
        <Button
          onClick={handleNavigate}
          variant="outline"
          className="flex-1 gap-2"
        >
          <Navigation className="w-4 h-4" />
          Navigate
        </Button>
      </div>
    </div>
  );
}