import React from "react";
import { Badge } from "@/components/ui/badge";
import TaskCard from "./TaskCard";
import { User, Circle, ArrowUpCircle, CheckCircle2, XCircle } from "lucide-react";

const STATUS_ORDER = ["Open", "In Progress", "Completed", "Cancelled"];

const STATUS_CONFIG = {
  "Open": { icon: Circle, color: "text-slate-500", bg: "bg-slate-100" },
  "In Progress": { icon: ArrowUpCircle, color: "text-blue-600", bg: "bg-blue-50" },
  "Completed": { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  "Cancelled": { icon: XCircle, color: "text-red-500", bg: "bg-red-50" }
};

export default function TaskKanbanView({ 
  tasks, 
  users, 
  onTaskClick, 
  onToggleComplete 
}) {
  // Group tasks by assigned user, then by status
  const tasksByUser = {};
  
  // Add "Unassigned" column
  tasksByUser["unassigned"] = {
    name: "Unassigned",
    email: null,
    tasksByStatus: {}
  };
  
  // Add columns for each user
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
  
  // Convert to array and filter out empty columns
  const columns = Object.entries(tasksByUser)
    .filter(([key, col]) => col.totalTasks > 0 || key === "unassigned")
    .sort((a, b) => {
      if (a[0] === "unassigned") return -1;
      if (b[0] === "unassigned") return 1;
      return a[1].name.localeCompare(b[1].name);
    });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
      {columns.map(([userId, column]) => (
        <div 
          key={userId} 
          className="flex-shrink-0 w-[300px] lg:w-[320px]"
        >
          {/* User Column Header */}
          <div className="bg-[#F3F4F6] rounded-t-xl px-4 py-3 border border-b-0 border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {userId === "unassigned" ? (
                  <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                    <User className="w-4 h-4 text-[#6B7280]" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#FAE008] flex items-center justify-center">
                    <span className="text-[#111827] font-semibold text-sm">
                      {column.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-[#111827] text-sm">
                    {column.name}
                  </h3>
                  {column.email && (
                    <p className="text-[11px] text-[#6B7280] truncate max-w-[180px]">
                      {column.email}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="bg-white text-[#4B5563] font-semibold">
                {column.totalTasks}
              </Badge>
            </div>
          </div>
          
          {/* Column Body with Status Groups */}
          <div className="bg-[#F9FAFB] rounded-b-xl border border-t-0 border-[#E5E7EB] p-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
            {column.totalTasks === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-[#E5E7EB] rounded-full flex items-center justify-center mb-3">
                  <User className="w-6 h-6 text-[#9CA3AF]" />
                </div>
                <p className="text-sm text-[#6B7280]">No tasks</p>
              </div>
            ) : (
              <div className="space-y-4">
                {STATUS_ORDER.map(status => {
                  const statusTasks = column.tasksByStatus[status] || [];
                  if (statusTasks.length === 0) return null;
                  
                  const config = STATUS_CONFIG[status];
                  const Icon = config.icon;
                  
                  return (
                    <div key={status}>
                      {/* Status Header */}
                      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${config.bg} mb-2`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span className={`text-xs font-semibold ${config.color}`}>
                          {status}
                        </span>
                        <Badge variant="secondary" className="bg-white/80 text-[#4B5563] text-[10px] px-1.5 py-0 h-5">
                          {statusTasks.length}
                        </Badge>
                      </div>
                      
                      {/* Tasks */}
                      <div className="space-y-2">
                        {statusTasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => onTaskClick(task)}
                            onToggleComplete={onToggleComplete}
                            showLinkedEntities={true}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}