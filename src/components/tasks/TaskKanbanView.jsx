import React from "react";
import { Badge } from "@/components/ui/badge";
import TaskCard from "./TaskCard";
import { User, Circle, ArrowUpCircle, CheckCircle2, XCircle } from "lucide-react";

const STATUS_ORDER = ["Open", "In Progress", "Completed", "Cancelled"];

const STATUS_CONFIG = {
  "Open": { icon: Circle, color: "text-slate-500", bg: "bg-slate-100", borderColor: "border-slate-200" },
  "In Progress": { icon: ArrowUpCircle, color: "text-blue-600", bg: "bg-blue-50", borderColor: "border-blue-200" },
  "Completed": { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", borderColor: "border-green-200" },
  "Cancelled": { icon: XCircle, color: "text-red-500", bg: "bg-red-50", borderColor: "border-red-200" }
};

export default function TaskKanbanView({ 
  tasks, 
  users, 
  onTaskClick, 
  onToggleComplete 
}) {
  // Group tasks by assigned user, then by status
  const tasksByUser = {};
  
  // Add "Unassigned" row
  tasksByUser["unassigned"] = {
    name: "Unassigned",
    email: null,
    tasksByStatus: {}
  };
  
  // Add rows for each user
  users.forEach(user => {
    tasksByUser[user.id] = {
      name: user.full_name,
      email: user.email,
      tasksByStatus: {}
    };
  });
  
  // Initialize status groups for each user
  Object.keys(tasksByUser).forEach(userId => {
    STATUS_ORDER.forEach(status => {
      tasksByUser[userId].tasksByStatus[status] = [];
    });
  });
  
  // Distribute tasks
  tasks.forEach(task => {
    const userId = task.assigned_to_user_id && tasksByUser[task.assigned_to_user_id] 
      ? task.assigned_to_user_id 
      : "unassigned";
    const status = task.status || "Open";
    if (tasksByUser[userId].tasksByStatus[status]) {
      tasksByUser[userId].tasksByStatus[status].push(task);
    }
  });
  
  // Calculate total tasks per user
  Object.keys(tasksByUser).forEach(userId => {
    tasksByUser[userId].totalTasks = Object.values(tasksByUser[userId].tasksByStatus)
      .reduce((sum, arr) => sum + arr.length, 0);
  });
  
  // Convert to array and filter out empty rows
  const rows = Object.entries(tasksByUser)
    .filter(([key, row]) => row.totalTasks > 0 || key === "unassigned")
    .sort((a, b) => {
      if (a[0] === "unassigned") return -1;
      if (b[0] === "unassigned") return 1;
      return a[1].name.localeCompare(b[1].name);
    });

  return (
    <div className="space-y-0">
      {/* Status Column Headers */}
      <div className="flex sticky top-0 z-10 bg-white pb-2">
        {/* Spacer for user column */}
        <div className="w-[180px] lg:w-[200px] flex-shrink-0" />
        
        {/* Status headers */}
        <div className="flex-1 flex gap-3 overflow-x-auto">
          {STATUS_ORDER.map(status => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            const count = rows.reduce((sum, [, row]) => sum + (row.tasksByStatus[status]?.length || 0), 0);
            
            return (
              <div 
                key={status} 
                className={`flex-1 min-w-[200px] lg:min-w-[240px] px-3 py-2 rounded-lg ${config.bg} border ${config.borderColor}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className={`text-sm font-semibold ${config.color}`}>
                      {status}
                    </span>
                  </div>
                  <Badge variant="secondary" className="bg-white/80 text-[#4B5563] text-xs">
                    {count}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Horizontal Lanes per Assignee */}
      <div className="space-y-3">
        {rows.map(([userId, row]) => (
          <div 
            key={userId} 
            className="flex bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] overflow-hidden"
          >
            {/* User Info - Fixed Left Column */}
            <div className="w-[180px] lg:w-[200px] flex-shrink-0 bg-[#F3F4F6] p-3 border-r border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                {userId === "unassigned" ? (
                  <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#6B7280]" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#FAE008] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#111827] font-semibold text-sm">
                      {row.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[#111827] text-sm truncate">
                    {row.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="bg-white text-[#4B5563] text-[10px] px-1.5 py-0 h-5">
                      {row.totalTasks} tasks
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status Columns */}
            <div className="flex-1 flex gap-3 p-3 overflow-x-auto">
              {STATUS_ORDER.map(status => {
                const statusTasks = row.tasksByStatus[status] || [];
                
                return (
                  <div 
                    key={status} 
                    className="flex-1 min-w-[200px] lg:min-w-[240px] space-y-2"
                  >
                    {statusTasks.length === 0 ? (
                      <div className="h-full min-h-[60px] flex items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-white/50">
                        <span className="text-xs text-[#9CA3AF]">No tasks</span>
                      </div>
                    ) : (
                      statusTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => onTaskClick(task)}
                          onToggleComplete={onToggleComplete}
                          showLinkedEntities={true}
                          compact
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}