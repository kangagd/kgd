import React from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, Briefcase, FolderKanban, User, Mail } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { TaskStatusBadge, TaskPriorityBadge, TaskTypeBadge } from "./TaskStatusBadge";

export default function TaskCard({ 
  task, 
  onClick, 
  onToggleComplete,
  showLinkedEntities = true,
  compact = false,
  hideAssignee = false,
  hideStatus = false 
}) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "Completed";
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <Card
      onClick={() => onClick?.(task)}
      className={`p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer ${
        task.status === "Completed" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="pt-0.5" onClick={handleCheckboxClick}>
          <Checkbox
            checked={task.status === "Completed"}
            onCheckedChange={(checked) => {
              onToggleComplete?.(task);
            }}
            className="h-5 w-5 border-2 data-[state=checked]:bg-[#16A34A] data-[state=checked]:border-[#16A34A]"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className={`font-semibold text-[#111827] mb-2 ${
            task.status === "Completed" ? "line-through text-[#6B7280]" : ""
          }`}>
            {task.title}
          </h4>

          {/* Chips Row */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {!hideStatus && <TaskStatusBadge status={task.status} />}
            {task.priority && task.priority !== "Medium" && (
              <TaskPriorityBadge priority={task.priority} />
            )}
            {task.type && <TaskTypeBadge type={task.type} />}
          </div>

          {/* Linked Entities & Due Date Row */}
          <div className="flex items-center justify-between gap-2">
            {showLinkedEntities && (
              <div className="flex flex-wrap gap-2 text-xs text-[#6B7280]">
                {task.project_id && (
                  <span className="flex items-center gap-1">
                    <FolderKanban className="w-3 h-3" />
                    {task.project_name || "Project"}
                  </span>
                )}
                {task.job_id && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    #{task.job_number || "Job"}
                  </span>
                )}
                {task.customer_id && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {task.customer_name || "Customer"}
                  </span>
                )}
                {task.email_thread_id && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </span>
                )}
              </div>
            )}
            
            {/* Due Date - Bottom Right */}
            {task.due_date && (
              <Badge 
                className={`text-xs flex-shrink-0 ${
                  isOverdue 
                    ? "bg-[#DC2626]/10 text-[#DC2626]" 
                    : isDueToday 
                      ? "bg-[#D97706]/10 text-[#D97706]" 
                      : "bg-[#F3F4F6] text-[#4B5563]"
                }`}
              >
                <Calendar className="w-3 h-3 mr-1" />
                {isOverdue ? "Overdue" : isDueToday ? "Today" : format(new Date(task.due_date), "MMM d")}
              </Badge>
            )}
          </div>
        </div>

        {/* Right Side: Assignee (only if not hidden) */}
        {!hideAssignee && task.assigned_to_name && (
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div 
              className="w-7 h-7 rounded-full bg-[#FAE008] flex items-center justify-center text-xs font-semibold text-[#111827]"
              title={task.assigned_to_name}
            >
              {task.assigned_to_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}