import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TaskCard from "./TaskCard";
import { User } from "lucide-react";

export default function TaskKanbanView({ 
  tasks, 
  users, 
  onTaskClick, 
  onToggleComplete 
}) {
  // Group tasks by assigned user
  const tasksByUser = {};
  
  // Add "Unassigned" column
  tasksByUser["unassigned"] = {
    name: "Unassigned",
    email: null,
    tasks: []
  };
  
  // Add columns for each user
  users.forEach(user => {
    tasksByUser[user.id] = {
      name: user.full_name,
      email: user.email,
      tasks: []
    };
  });
  
  // Distribute tasks
  tasks.forEach(task => {
    if (task.assigned_to_user_id && tasksByUser[task.assigned_to_user_id]) {
      tasksByUser[task.assigned_to_user_id].tasks.push(task);
    } else {
      tasksByUser["unassigned"].tasks.push(task);
    }
  });
  
  // Convert to array and filter out empty columns (except unassigned if it has tasks)
  const columns = Object.entries(tasksByUser)
    .filter(([key, col]) => col.tasks.length > 0 || key === "unassigned")
    .sort((a, b) => {
      // Unassigned always first
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
          {/* Column Header */}
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
                {column.tasks.length}
              </Badge>
            </div>
          </div>
          
          {/* Column Body */}
          <div className="bg-[#F9FAFB] rounded-b-xl border border-t-0 border-[#E5E7EB] p-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
            {column.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-[#E5E7EB] rounded-full flex items-center justify-center mb-3">
                  <User className="w-6 h-6 text-[#9CA3AF]" />
                </div>
                <p className="text-sm text-[#6B7280]">No tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {column.tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onToggleComplete={onToggleComplete}
                    showLinkedEntities={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}