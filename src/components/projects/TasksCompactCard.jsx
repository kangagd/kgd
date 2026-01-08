import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TaskFormModal from "../tasks/TaskFormModal";
import TaskDetailModal from "../tasks/TaskDetailModal";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

export default function TasksCompactCard({ tasks = [], onViewAll, onAddTask, entityType = 'project', entityId, entityName, customerId, customerName, onFilteredViewAll, onTaskUpdate, onTaskDelete, onTaskStatusChange }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const navigate = useNavigate();
  
  const handleViewAll = () => {
    if (entityType === 'project' && entityId) {
      navigate(`${createPageUrl("Tasks")}?projectId=${entityId}`);
    } else if (onViewAll) {
      onViewAll();
    } else {
      toast.error("Action not configured yet");
    }
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle 
          onClick={(e) => {
            e.stopPropagation();
            handleViewAll();
          }}
          className="text-[16px] font-semibold text-[#111827] cursor-pointer hover:underline"
        >
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Debug info for development */}
        {tasks.length === 0 && console.log('[TasksCompactCard] No tasks provided - tasks prop:', tasks)}
        
        {/* Task List */}
        <div className="space-y-2">
          {tasks.length > 0 ? (
            tasks.slice(0, 3).map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTaskDetailModal(true);
                  setSelectedTask(task);
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-[#FAE008] rounded border-gray-300"
                    checked={task.status === 'Completed'}
                    onChange={(e) => {
                      e.stopPropagation();
                      onTaskStatusChange(task.id, task.status === 'Completed' ? 'Open' : 'Completed');
                    }}
                  />
                  <span className={`text-sm ${task.status === 'Completed' ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                    {task.title}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString()}` : 'No Due Date'}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No tasks for this project.</p>
          )}
          {tasks.length > 3 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleViewAll(); }}
              className="text-sm text-[#FAE008] hover:underline mt-2 inline-block"
            >
              View all {tasks.length} tasks
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleViewAll();
            }}
            variant="outline"
            size="sm"
            className="flex-1 text-[13px] h-8"
          >
            View all tasks
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            size="sm"
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] text-[13px] h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add task
          </Button>
        </div>
      </CardContent>

      <TaskFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => {
          if (onAddTask) {
            onAddTask(data);
          } else {
            toast.error("Action not configured yet");
          }
          setShowCreateModal(false);
        }}
        preLinkedEntity={{
          type: entityType,
          id: entityId,
          name: entityName,
          customer_id: customerId,
          customer_name: customerName
        }}
      />

      <TaskDetailModal
        open={showTaskDetailModal}
        onClose={() => setShowTaskDetailModal(false)}
        task={selectedTask}
        onUpdate={onTaskUpdate}
        onDelete={onTaskDelete}
        onMarkComplete={async (taskToComplete) => {
          await onTaskStatusChange(taskToComplete.id, 'Completed');
          setShowTaskDetailModal(false);
        }}
      />
    </Card>
  );
}