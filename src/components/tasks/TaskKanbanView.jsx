import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import TaskCard from "./TaskCard";
import { User, Circle, ArrowUpCircle, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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
  onToggleComplete,
  onTaskUpdate 
}) {
  const [collapsedLanes, setCollapsedLanes] = useState({});

  const toggleLane = (userId) => {
    setCollapsedLanes(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

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

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    
    // Parse droppable IDs: format is "userId-status"
    const [sourceUserId, sourceStatus] = source.droppableId.split("__");
    const [destUserId, destStatus] = destination.droppableId.split("__");
    
    // No change
    if (sourceUserId === destUserId && sourceStatus === destStatus) return;
    
    // Find the task
    const task = tasks.find(t => t.id === draggableId);
    if (!task || !onTaskUpdate) return;
    
    // Build update object
    const updates = {};
    
    if (sourceStatus !== destStatus) {
      updates.status = destStatus;
    }
    
    if (sourceUserId !== destUserId) {
      if (destUserId === "unassigned") {
        updates.assigned_to = null;
        updates.assigned_to_name = null;
        updates.assigned_to_user_id = null;
      } else {
        const destUser = users.find(u => u.id === destUserId);
        if (destUser) {
          updates.assigned_to = destUser.email;
          updates.assigned_to_name = destUser.full_name;
          updates.assigned_to_user_id = destUser.id;
        }
      }
    }
    
    if (Object.keys(updates).length > 0) {
      onTaskUpdate(task.id, updates);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
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
          {rows.map(([userId, row]) => {
            const isCollapsed = collapsedLanes[userId];
            
            return (
              <div 
                key={userId} 
                className="flex bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] overflow-hidden"
              >
                {/* User Info - Fixed Left Column */}
                <div 
                  onClick={() => toggleLane(userId)}
                  className="w-[180px] lg:w-[200px] flex-shrink-0 bg-[#F3F4F6] p-3 border-r border-[#E5E7EB] cursor-pointer hover:bg-[#EBEDF0] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    )}
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
                  {isCollapsed && (
                    <div className="flex gap-1 mt-2 ml-6">
                      {STATUS_ORDER.map(status => {
                        const count = row.tasksByStatus[status]?.length || 0;
                        if (count === 0) return null;
                        const config = STATUS_CONFIG[status];
                        return (
                          <Badge key={status} className={`${config.bg} ${config.color} text-[10px] px-1.5 py-0 h-5 border ${config.borderColor}`}>
                            {count}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Status Columns */}
                {!isCollapsed && (
                  <div className="flex-1 flex gap-3 p-3 overflow-x-auto">
                    {STATUS_ORDER.map(status => {
                      const statusTasks = row.tasksByStatus[status] || [];
                      const droppableId = `${userId}__${status}`;
                      
                      return (
                        <Droppable key={droppableId} droppableId={droppableId}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex-1 min-w-[200px] lg:min-w-[240px] space-y-2 rounded-lg p-1 transition-colors ${
                                snapshot.isDraggingOver ? 'bg-[#FAE008]/20 ring-2 ring-[#FAE008]/50' : ''
                              }`}
                            >
                              {statusTasks.length === 0 && !snapshot.isDraggingOver ? (
                                <div className="h-full min-h-[60px] flex items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-white/50">
                                  <span className="text-xs text-[#9CA3AF]">No tasks</span>
                                </div>
                              ) : (
                                statusTasks.map((task, index) => (
                                  <Draggable key={task.id} draggableId={task.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={snapshot.isDragging ? 'opacity-90 rotate-1 scale-105' : ''}
                                      >
                                        <TaskCard
                                          task={task}
                                          onClick={() => onTaskClick(task)}
                                          showLinkedEntities={true}
                                          hideAssignee={true}
                                          hideStatus={true}
                                          hideCheckbox={true}
                                          compact
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                ))
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}