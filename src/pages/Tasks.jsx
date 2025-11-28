import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckSquare, Loader2, Filter, Calendar, LayoutList, Columns } from "lucide-react";
import { isPast, isToday, isThisWeek, startOfDay } from "date-fns";
import TaskCard from "../components/tasks/TaskCard";
import TaskFormModal from "../components/tasks/TaskFormModal";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import TaskKanbanView from "../components/tasks/TaskKanbanView";
import { toast } from "sonner";

export default function Tasks() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [dueFilter, setDueFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // "list" or "kanban"
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date')
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowCreateModal(false);
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success("Task updated");
    },
    onError: () => toast.error("Failed to update task")
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task")
  });

  const handleToggleComplete = async (task) => {
    const newStatus = task.status === "Completed" ? "Open" : "Completed";
    updateMutation.mutate({ 
      id: task.id, 
      data: { 
        status: newStatus,
        completed_at: newStatus === "Completed" ? new Date().toISOString() : null
      } 
    });
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

  const handleDelete = (id) => {
    if (confirm("Delete this task?")) {
      deleteMutation.mutate(id);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Status filter
    if (statusFilter === "open" && (task.status === "Completed" || task.status === "Cancelled")) return false;
    if (statusFilter === "in_progress" && task.status !== "In Progress") return false;
    if (statusFilter === "completed" && task.status !== "Completed") return false;

    // Due filter
    if (dueFilter !== "all" && task.due_date) {
      const dueDate = new Date(task.due_date);
      const today = startOfDay(new Date());
      
      if (dueFilter === "overdue" && !isPast(dueDate)) return false;
      if (dueFilter === "today" && !isToday(dueDate)) return false;
      if (dueFilter === "this_week" && !isThisWeek(dueDate, { weekStartsOn: 1 })) return false;
    } else if (dueFilter === "overdue" && !task.due_date) {
      return false;
    }

    // Assignee filter
    if (assigneeFilter === "me" && task.assigned_to_user_id !== user?.id) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== "me" && task.assigned_to_user_id !== assigneeFilter) return false;

    // Technician: only show assigned tasks
    if (isTechnician && task.assigned_to_user_id !== user?.id) return false;

    return true;
  });

  // Group tasks for technician mobile view
  const groupedTasks = isTechnician ? {
    overdue: filteredTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== "Completed"),
    today: filteredTasks.filter(t => t.due_date && isToday(new Date(t.due_date)) && t.status !== "Completed"),
    upcoming: filteredTasks.filter(t => {
      if (!t.due_date || t.status === "Completed") return false;
      const due = new Date(t.due_date);
      return !isPast(due) && !isToday(due);
    }),
    noDue: filteredTasks.filter(t => !t.due_date && t.status !== "Completed")
  } : null;

  // Technician Mobile View
  if (isTechnician) {
    return (
      <div className="p-4 bg-[#ffffff] min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-[#111827]">My Tasks</h1>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overdue */}
              {groupedTasks.overdue.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#DC2626] mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Overdue ({groupedTasks.overdue.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedTasks.overdue.map(task => {
                      const assignee = users.find(u => u.id === task.assigned_to_user_id);
                      const displayTask = {
                        ...task,
                        assigned_to_name: assignee ? (assignee.display_name || assignee.full_name) : task.assigned_to_name
                      };
                      return (
                        <TaskCard
                          key={task.id}
                          task={displayTask}
                          onClick={setSelectedTask}
                          onToggleComplete={handleToggleComplete}
                          compact
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Today */}
              {groupedTasks.today.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#D97706] mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Today ({groupedTasks.today.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedTasks.today.map(task => {
                      const assignee = users.find(u => u.id === task.assigned_to_user_id);
                      const displayTask = {
                        ...task,
                        assigned_to_name: assignee ? (assignee.display_name || assignee.full_name) : task.assigned_to_name
                      };
                      return (
                        <TaskCard
                          key={task.id}
                          task={displayTask}
                          onClick={setSelectedTask}
                          onToggleComplete={handleToggleComplete}
                          compact
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {groupedTasks.upcoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#4B5563] mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Upcoming ({groupedTasks.upcoming.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedTasks.upcoming.map(task => {
                      const assignee = users.find(u => u.id === task.assigned_to_user_id);
                      const displayTask = {
                        ...task,
                        assigned_to_name: assignee ? (assignee.display_name || assignee.full_name) : task.assigned_to_name
                      };
                      return (
                        <TaskCard
                          key={task.id}
                          task={displayTask}
                          onClick={setSelectedTask}
                          onToggleComplete={handleToggleComplete}
                          compact
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No Due Date */}
              {groupedTasks.noDue.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#6B7280] mb-3">
                    No Due Date ({groupedTasks.noDue.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedTasks.noDue.map(task => {
                      const assignee = users.find(u => u.id === task.assigned_to_user_id);
                      const displayTask = {
                        ...task,
                        assigned_to_name: assignee ? (assignee.display_name || assignee.full_name) : task.assigned_to_name
                      };
                      return (
                        <TaskCard
                          key={task.id}
                          task={displayTask}
                          onClick={setSelectedTask}
                          onToggleComplete={handleToggleComplete}
                          compact
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredTasks.length === 0 && (
                <div className="text-center py-16">
                  <CheckSquare className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" />
                  <p className="text-[#6B7280]">No tasks assigned to you</p>
                </div>
              )}
            </div>
          )}

          {/* Modals */}
          <TaskFormModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSubmit={(data) => createMutation.mutate(data)}
            isSubmitting={createMutation.isPending}
          />
          <TaskDetailModal
            open={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            task={selectedTask}
            onUpdate={(id, data) => updateMutation.mutate({ id, data })}
            onDelete={handleDelete}
            onMarkComplete={handleMarkComplete}
            isUpdating={updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  // Admin Desktop View
  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-[#111827]">Tasks</h1>
            <p className="text-sm text-[#6B7280] mt-1">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          {/* Status Tabs */}
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
            <TabsList className="bg-white w-full lg:w-auto">
              <TabsTrigger value="open" className="flex-1 lg:flex-initial">Open</TabsTrigger>
              <TabsTrigger value="in_progress" className="flex-1 lg:flex-initial">In Progress</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1 lg:flex-initial">Completed</TabsTrigger>
              <TabsTrigger value="all" className="flex-1 lg:flex-initial">All</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Additional Filters */}
          <div className="flex flex-wrap gap-3 flex-1">
            <Select value={dueFilter} onValueChange={setDueFilter}>
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue placeholder="Due date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="me">Assigned to Me</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.display_name || u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E5E7EB] p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}
            >
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className={viewMode === "kanban" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}
            >
              <Columns className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Task Views */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-[#E5E7EB]">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" />
            <p className="text-[#6B7280] mb-4">No tasks found</p>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create your first task
            </Button>
          </div>
        ) : viewMode === "kanban" ? (
          <TaskKanbanView
            tasks={tasks.map(t => {
              const assignee = users.find(u => u.id === t.assigned_to_user_id);
              return {
                ...t,
                assigned_to_name: assignee ? (assignee.display_name || assignee.full_name) : t.assigned_to_name
              };
            })}
            users={users}
            onTaskClick={setSelectedTask}
            onToggleComplete={handleToggleComplete}
            onTaskUpdate={(id, data) => updateMutation.mutate({ id, data })}
          />
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => {
              const assignee = users.find(u => u.id === task.assigned_to_user_id);
              const displayTask = {
                ...task,
                assigned_to_name: assignee ? (assignee.display_name || assignee.full_name) : task.assigned_to_name
              };
              return (
                <TaskCard
                  key={task.id}
                  task={displayTask}
                  onClick={setSelectedTask}
                  onToggleComplete={handleToggleComplete}
                />
              );
            })}
          </div>
        )}

        {/* Modals */}
        <TaskFormModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
        />
        <TaskDetailModal
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          onDelete={handleDelete}
          onMarkComplete={handleMarkComplete}
          isUpdating={updateMutation.isPending}
        />
      </div>
    </div>
  );
}