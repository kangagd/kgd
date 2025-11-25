import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, CheckSquare, Loader2 } from "lucide-react";
import TaskCard from "./TaskCard";
import TaskFormModal from "./TaskFormModal";
import TaskDetailModal from "./TaskDetailModal";
import { toast } from "sonner";

export default function TasksPanel({
  entityType, // 'project' | 'job' | 'customer' | 'email_thread'
  entityId,
  entityName,
  entityNumber // for jobs
}) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

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
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowCreateModal(false);
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
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

  const openTasks = tasks.filter(t => t.status !== "Completed" && t.status !== "Cancelled");
  const completedTasks = tasks.filter(t => t.status === "Completed" || t.status === "Cancelled");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-[#4B5563]" />
          <h3 className="font-semibold text-[#111827]">Tasks</h3>
          {tasks.length > 0 && (
            <span className="text-sm text-[#6B7280]">
              ({openTasks.length} open)
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Task
        </Button>
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
            onClick={() => setShowCreateModal(true)}
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