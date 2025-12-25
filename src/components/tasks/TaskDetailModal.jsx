import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CalendarIcon, 
  Loader2, 
  CheckCircle2, 
  Briefcase, 
  FolderKanban, 
  User, 
  Mail,
  Pencil,
  Trash2,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { TaskStatusBadge, TaskPriorityBadge, TaskTypeBadge } from "./TaskStatusBadge";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

const TASK_TYPES = ["Call", "Email", "Site Visit", "Internal", "Follow-up", "Parts / Ordering", "Other"];
const TASK_STATUSES = ["Open", "In Progress", "Completed", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Medium", "High"];

export default function TaskDetailModal({
  open,
  onClose,
  task,
  onUpdate,
  onDelete,
  onMarkComplete,
  isUpdating = false
}) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  React.useEffect(() => {
    if (task) {
      setEditData({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "Open",
        type: task.type || "Other",
        priority: task.priority || "Medium",
        due_date: task.due_date ? new Date(task.due_date) : null,
        assigned_to_user_id: task.assigned_to_user_id || ""
      });
    }
  }, [task]);

  const handleAssigneeChange = (userId) => {
    const user = users.find(u => u.id === userId);
    setEditData(prev => ({
      ...prev,
      assigned_to_user_id: userId,
      assigned_to_name: user ? (user.display_name || user.full_name) : "",
      assigned_to_email: user?.email || ""
    }));
  };

  const handleSave = () => {
    const updateData = {
      ...editData,
      due_date: editData.due_date ? editData.due_date.toISOString() : null
    };
    onUpdate(task.id, updateData);
    setIsEditing(false);
  };

  const handleNavigateToEntity = (type, id) => {
    onClose();
    if (type === 'project') {
      navigate(`${createPageUrl("Projects")}?projectId=${id}`);
    } else if (type === 'job') {
      navigate(`${createPageUrl("Jobs")}?jobId=${id}`);
    } else if (type === 'customer') {
      navigate(`${createPageUrl("Customers")}?customerId=${id}`);
    } else if (type === 'email') {
      navigate(`${createPageUrl("Inbox")}?threadId=${id}`);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex-1">{isEditing ? "Edit Task" : "Task Details"}</DialogTitle>
            {!isEditing && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  className="h-8 w-8"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(task.id)}
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={editData.title}
                onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select
                  value={editData.status}
                  onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={editData.priority}
                  onValueChange={(value) => setEditData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Type</Label>
              <Select
                value={editData.type}
                onValueChange={(value) => setEditData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editData.due_date ? format(editData.due_date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editData.due_date}
                    onSelect={(date) => setEditData(prev => ({ ...prev, due_date: date }))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Assign To</Label>
              <Select
                value={editData.assigned_to_user_id}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>{user.display_name || user.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleSave}
                className="flex-1 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <h3 className={`text-lg font-semibold ${task.status === "Completed" ? "line-through text-[#6B7280]" : ""}`}>
              {task.title}
            </h3>

            {/* Status Chips */}
            <div className="flex flex-wrap gap-2">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              {task.type && <TaskTypeBadge type={task.type} />}
            </div>

            <Separator />

            {/* Details */}
            <div className="space-y-3">
              {task.due_date && (
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-sm">
                    Due: {format(new Date(task.due_date), "PPP")}
                  </span>
                </div>
              )}

              {(() => {
                const assignee = users.find(u => u.id === task.assigned_to_user_id);
                const displayName = assignee ? (assignee.display_name || assignee.full_name) : task.assigned_to_name;
                if (!displayName) return null;
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FAE008] flex items-center justify-center text-xs font-semibold">
                      {displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm">Assigned to: {displayName}</span>
                  </div>
                );
              })()}

              {task.description && (
                <div className="bg-[#F9FAFB] p-3 rounded-lg">
                  <Label className="text-xs text-[#6B7280]">Description</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}
            </div>

            {/* Linked Entities */}
            {(task.project_id || task.job_id || task.customer_id || task.email_thread_id) && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs text-[#6B7280] mb-2 block">Linked To</Label>
                  <div className="space-y-2">
                    {task.project_id && (
                      <button
                        type="button"
                        onClick={() => handleNavigateToEntity('project', task.project_id)}
                        className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
                      >
                        <FolderKanban className="w-4 h-4" />
                        Project: {task.project_name}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    {task.job_id && (
                      <button
                        type="button"
                        onClick={() => handleNavigateToEntity('job', task.job_id)}
                        className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
                      >
                        <Briefcase className="w-4 h-4" />
                        Job #{task.job_number}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    {task.customer_id && (
                      <button
                        type="button"
                        onClick={() => handleNavigateToEntity('customer', task.customer_id)}
                        className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
                      >
                        <User className="w-4 h-4" />
                        Customer: {task.customer_name}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    {task.email_thread_id && (
                      <button
                        type="button"
                        onClick={() => handleNavigateToEntity('email', task.email_thread_id)}
                        className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
                      >
                        <Mail className="w-4 h-4" />
                        Email: {task.email_thread_subject}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Mark Complete Button */}
            {task.status !== "Completed" && (
              <>
                <Separator />
                <Button
                  type="button"
                  onClick={() => onMarkComplete(task)}
                  className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Mark as Completed
                </Button>
              </>
            )}

            {/* Meta Info */}
            <div className="text-xs text-[#9CA3AF] pt-2">
              Created {task.created_date && format(new Date(task.created_date), "PPP")}
              {task.completed_at && (
                <> • Completed {format(new Date(task.completed_at), "PPP")}</>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}