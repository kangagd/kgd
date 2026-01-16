import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, Phone, Navigation, User, CheckCircle2, Circle, Edit2, X, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { createPageUrl } from "@/utils";
import AttentionItemsPanel from "../attention/AttentionItemsPanel";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    scheduled_date: job.scheduled_date || '',
    scheduled_time: job.scheduled_time || '',
    assigned_to: job.assigned_to || []
  });
  const [techniciansSearch, setTechniciansSearch] = useState('');
  const queryClient = useQueryClient();

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

  const handleCall = () => {
    if (job.customer_phone) {
      window.location.href = `tel:${job.customer_phone}`;
    }
  };

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}&travelmode=driving`, '_blank');
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: job.id,
      data: editData
    });
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

      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">#{job.job_number}</Badge>
            {job.project_name && (
              <Badge className="bg-blue-100 text-blue-700 border-0">{job.project_name}</Badge>
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

        <h3 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
          {job.customer_name}
        </h3>

        {/* Schedule Info */}
        {!isEditing && job.scheduled_date && (
          <div className="flex items-center gap-4 text-[14px] text-[#4B5563] flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#6B7280]" />
              <span>{format(parseISO(job.scheduled_date), 'MMM d, yyyy')}</span>
            </div>
            {job.scheduled_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <span>{job.scheduled_time}</span>
              </div>
            )}
            {job.assigned_to && job.assigned_to.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#6B7280] font-medium">Assigned to:</span>
                <TechnicianAvatarGroup
                  technicians={job.assigned_to.map((email, idx) => ({
                    email,
                    full_name: job.assigned_to_name?.[idx] || email,
                    id: email
                  }))}
                  maxDisplay={3}
                  size="sm"
                />
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
                      {tech.full_name}
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
      <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
        <MapPin className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Address</div>
          <div className="text-[14px] text-[#111827]">{job.address}</div>
        </div>
      </div>

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



      {/* Project Link */}
      {job.project_name && (
        <div className="p-3 bg-[#FAE008]/10 rounded-lg border border-[#FAE008]/30">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Part of Project</div>
          <div className="text-[14px] font-semibold text-[#111827]">{job.project_name}</div>
        </div>
      )}

      {/* Notes Preview */}
      {job.notes && job.notes !== "<p><br></p>" && (
        <div className="p-3 bg-[#FAE008]/10 rounded-lg">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Notes</div>
          <div 
            className="text-[14px] text-[#4B5563] line-clamp-3 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: job.notes }}
          />
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