import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { handleEnterToNextField } from "../common/formNavigator";

const TASK_TYPES = ["Call", "Email", "Site Visit", "Internal", "Follow-up", "Parts / Ordering", "Other"];
const TASK_STATUSES = ["Open", "In Progress", "Completed", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Medium", "High"];

export default function TaskFormModal({
  open,
  onClose,
  onSubmit,
  task = null,
  preLinkedEntity = null, // { type: 'project' | 'job' | 'customer' | 'email_thread', id: string, name: string }
  isSubmitting = false
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "Open",
    type: "Other",
    priority: "Medium",
    due_date: null,
    assigned_to_user_id: "",
    assigned_to_name: "",
    assigned_to_email: "",
    project_id: "",
    project_name: "",
    job_id: "",
    job_number: null,
    customer_id: "",
    customer_name: "",
    email_thread_id: "",
    email_thread_subject: ""
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        // Try using backend function for managers to bypass RLS
        const response = await base44.functions.invoke('getAllUsers');
        return response.data.users || [];
      } catch (error) {
        // Fallback to direct query
        return await base44.entities.User.list();
      }
    }
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: !!preLinkedEntity && preLinkedEntity.type === 'job',
    staleTime: 60000
  });

  // Handle FormNavigator save request
  useEffect(() => {
    const onSaveRequest = () => handleSave();
    window.addEventListener("FORM_NAV_SAVE_REQUEST", onSaveRequest);
    return () => window.removeEventListener("FORM_NAV_SAVE_REQUEST", onSaveRequest);
  }, [formData]);

  useEffect(() => {
    if (!open) return; // Don't run if modal isn't open
    
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "Open",
        type: task.type || "Other",
        priority: task.priority || "Medium",
        due_date: task.due_date ? new Date(task.due_date) : null,
        assigned_to_user_id: task.assigned_to_user_id || "",
        assigned_to_name: task.assigned_to_name || "",
        assigned_to_email: task.assigned_to_email || "",
        project_id: task.project_id || "",
        project_name: task.project_name || "",
        job_id: task.job_id || "",
        job_number: task.job_number || null,
        customer_id: task.customer_id || "",
        customer_name: task.customer_name || "",
        email_thread_id: task.email_thread_id || "",
        email_thread_subject: task.email_thread_subject || ""
      });
    } else {
      // Reset form
      // If pre-linked to a job, also link to its project
      let projectId = "";
      let projectName = "";
      
      if (preLinkedEntity?.type === 'job' && jobs.length > 0) {
        const linkedJob = jobs.find(j => j.id === preLinkedEntity.id);
        if (linkedJob && linkedJob.project_id) {
          projectId = linkedJob.project_id;
          projectName = linkedJob.project_name || "";
        }
      }

      setFormData({
        title: "",
        description: "",
        status: "Open",
        type: "Other",
        priority: "Medium",
        due_date: null,
        assigned_to_user_id: "",
        assigned_to_name: "",
        assigned_to_email: "",
        project_id: preLinkedEntity?.type === 'project' ? preLinkedEntity.id : projectId,
        project_name: preLinkedEntity?.type === 'project' ? preLinkedEntity.name : projectName,
        job_id: preLinkedEntity?.type === 'job' ? preLinkedEntity.id : "",
        job_number: preLinkedEntity?.type === 'job' ? preLinkedEntity.number : null,
        customer_id: preLinkedEntity?.type === 'customer' ? preLinkedEntity.id : "",
        customer_name: preLinkedEntity?.type === 'customer' ? preLinkedEntity.name : "",
        email_thread_id: preLinkedEntity?.type === 'email_thread' ? preLinkedEntity.id : "",
        email_thread_subject: preLinkedEntity?.type === 'email_thread' ? preLinkedEntity.name : ""
      });
    }
  }, [task?.id, preLinkedEntity?.id, preLinkedEntity?.type, open]);

  const handleAssigneeChange = (userId) => {
    const user = users.find(u => u.id === userId);
    setFormData(prev => ({
      ...prev,
      assigned_to_user_id: userId,
      assigned_to_name: user ? (user.display_name || user.full_name) : "",
      assigned_to_email: user?.email || ""
    }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) return;

    const submitData = {
      ...formData,
      due_date: formData.due_date ? formData.due_date.toISOString() : null
    };

    onSubmit(submitData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} onKeyDownCapture={handleEnterToNextField} className="space-y-4">
          {/* Title */}
          <div>
            <Label>Title *</Label>
            <Input
              data-nav="true"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Task title..."
              required
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status (only for edit) */}
          {task && (
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Due Date */}
          <div>
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div>
            <Label>Assign To</Label>
            <Select
              value={formData.assigned_to_user_id}
              onValueChange={handleAssigneeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.display_name || user.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {/* Linked Entity Display */}
          {(formData.project_name || formData.job_number || formData.customer_name || formData.email_thread_subject) && (
            <div className="text-sm text-[#6B7280] bg-[#F9FAFB] p-3 rounded-lg">
              <span className="font-medium">Linked to: </span>
              {formData.project_name && <span>Project: {formData.project_name}</span>}
              {formData.job_number && <span>Job #{formData.job_number}</span>}
              {formData.customer_name && <span>Customer: {formData.customer_name}</span>}
              {formData.email_thread_subject && <span>Email: {formData.email_thread_subject}</span>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit"
              data-nav="true"
              className="flex-1 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
              disabled={isSubmitting || !formData.title.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                task ? "Update Task" : "Create Task"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}