import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, CheckSquare, Loader2 } from "lucide-react";
import TaskCard from "./TaskCard";
import TaskFormModal from "./TaskFormModal";
import TaskDetailModal from "./TaskDetailModal";
import { toast } from "sonner";
import { getActiveTasks, filterTasksByUrgency } from "./taskFilters";

export default function TasksPanel({
  entityType, // 'project' | 'job' | 'customer' | 'email_thread'
  entityId,
  entityName,
  entityNumber, // for jobs
  compact = false, // for sidebar compact view
  initialFilter = null // 'overdue' | 'due_today' | 'due_soon' | null
}) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [urgencyFilter, setUrgencyFilter] = useState(initialFilter);

  // Listen for filter events
  React.useEffect(() => {
    const handleFilterEvent = (e) => {
      setUrgencyFilter(e.detail.filter);
    };
    window.addEventListener('setTaskFilter', handleFilterEvent);
    return () => window.removeEventListener('setTaskFilter', handleFilterEvent);
  }, []);

  // Build filter based on entity type
  const getFilter = () => {
    switch (entityType) {
      case 'project': return { project_id: entityId };
      case 'job': return { job_id: entityId };
      case 'customer': return { customer_id: entityId };
      case 'email_thread': return { email_thread_id: entityId };
      default: return {};
    }
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', entityType, entityId],
    queryFn: () => base44.entities.Task.filter(getFilter(), '-created_date'),
    enabled: !!entityId
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newTask = await base44.entities.Task.create(data);
      
      // Update project activity if task is linked to a project
      if (newTask.project_id) {
        try {
          await base44.functions.invoke('updateProjectActivity', { 
            project_id: newTask.project_id,
            activity_type: 'Task Created'
          });
        } catch (err) {
          console.error('Failed to update project activity:', err);
        }
      }
      
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowCreateModal(false);
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task")
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updatedTask = await base44.entities.Task.update(id, data);
      
      // Update project activity if task is linked to a project
      if (updatedTask.project_id) {
        try {
          await base44.functions.invoke('updateProjectActivity', { 
            project_id: updatedTask.project_id,
            activity_type: 'Task Updated'
          });
        } catch (err) {
          console.error('Failed to update project activity:', err);
        }
      }
      
      return updatedTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success("Task updated");
    },
    onError: () => toast.error("Failed to update task")
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task")
  });

  const handleToggleComplete = async (task) => {
    const newStatus = task.status === "Completed" ? "Open" : "Completed";
    const updates = { 
      status: newStatus,
      completed_at: newStatus === "Completed" ? new Date().toISOString() : null
    };
    updateMutation.mutate({ id: task.id, data: updates });
  };

  const handleCreate = (data) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (id, data) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id) => {
    if (confirm("Delete this task?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleMarkComplete = (task) => {
    updateMutation.mutate({ 
      id: task.id, 
      data: { 
        status: "Completed", 
        completed_at: new Date().toISOString() 
      } 
    });
    setSelectedTask(null);
  };

  const preLinkedEntity = {
    type: entityType,
    id: entityId,
    name: entityName,
    number: entityNumber
  };

  // Apply urgency filtering using shared logic
  const allOpenTasks = getActiveTasks(tasks);
  const openTasks = urgencyFilter ? filterTasksByUrgency(tasks, urgencyFilter) : allOpenTasks;
  const completedTasks = tasks.filter(t => !getActiveTasks([t]).length);

  // Compact view for sidebar
  if (compact) {
    return (
      <div className="space-y-2">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          {tasks.length > 0 && (
            <span className="text-[12px] text-[#6B7280]">
              {openTasks.length} open
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            className="h-7 px-2 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Compact Task List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-4 text-[#9CA3AF]">
            <p className="text-[13px]">No tasks yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {openTasks.slice(0, 5).map(task => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="flex items-start gap-2 p-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] cursor-pointer transition-colors"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleComplete(task);
                  }}
                  className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    task.status === "Completed"
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-[#D1D5DB] hover:border-[#FAE008]"
                  }`}
                >
                  {task.status === "Completed" && (
                    <CheckSquare className="w-3 h-3" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${
                    task.status === "Completed" ? "text-[#9CA3AF] line-through" : "text-[#111827]"
                  }`}>
                    {task.title}
                  </p>
                  {task.due_date && (
                    <p className={`text-[11px] ${
                      new Date(task.due_date) < new Date() && task.status !== "Completed"
                        ? "text-red-500"
                        : "text-[#9CA3AF]"
                    }`}>
                      Due {new Date(task.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {openTasks.length > 5 && (
              <p className="text-[11px] text-[#6B7280] text-center pt-1">
                +{openTasks.length - 5} more
              </p>
            )}
            {completedTasks.length > 0 && (
              <p className="text-[11px] text-[#9CA3AF] text-center pt-1">
                {completedTasks.length} completed
              </p>
            )}
          </div>
        )}

        {/* Modals */}
        <TaskFormModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          preLinkedEntity={preLinkedEntity}
          isSubmitting={createMutation.isPending}
        />
        <TaskDetailModal
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onMarkComplete={handleMarkComplete}
          isUpdating={updateMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#4B5563]" />
            <h3 className="font-semibold text-[#111827]">Tasks</h3>
            {tasks.length > 0 && (
              <span className="text-sm text-[#6B7280]">
                ({urgencyFilter ? openTasks.length : allOpenTasks.length} {urgencyFilter ? 'filtered' : 'open'})
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>
        </div>

        {/* Filter Pills */}
        {urgencyFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6B7280]">Filtered by:</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <span className="font-medium">
                {urgencyFilter === 'overdue' && 'Overdue'}
                {urgencyFilter === 'due_today' && 'Due Today'}
                {urgencyFilter === 'due_soon' && 'Due Soon'}
              </span>
              <button
                onClick={() => setUrgencyFilter(null)}
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-[#6B7280]">
          <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No tasks yet</p>
          <Button
            variant="link"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            className="text-[#2563EB]"
          >
            Create the first task
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Open Tasks */}
          {openTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={setSelectedTask}
              onToggleComplete={handleToggleComplete}
              showLinkedEntities={false}
            />
          ))}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <details className="group">
              <summary className="text-sm text-[#6B7280] cursor-pointer hover:text-[#4B5563] py-2">
                {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}
              </summary>
              <div className="space-y-3 mt-2">
                {completedTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={setSelectedTask}
                    onToggleComplete={handleToggleComplete}
                    showLinkedEntities={false}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Create Modal */}
      <TaskFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        preLinkedEntity={preLinkedEntity}
        isSubmitting={createMutation.isPending}
      />

      {/* Detail Modal */}
      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onMarkComplete={handleMarkComplete}
        isUpdating={updateMutation.isPending}
      />
    </div>
  );
}