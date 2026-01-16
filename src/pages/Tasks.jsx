import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Plus,
  CheckSquare,
  Loader2,
  Filter,
  Calendar,
  LayoutList,
  Columns,
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { useSearchParams } from "react-router-dom";
import { differenceInDays, isPast, isToday, isThisWeek, startOfDay } from "date-fns";

import BackButton from "../components/common/BackButton";
import TaskCard from "../components/tasks/TaskCard";
import TaskFormModal from "../components/tasks/TaskFormModal";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import TaskKanbanView from "../components/tasks/TaskKanbanView";

export default function Tasks() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);

  // View
  const [viewMode, setViewMode] = useState("kanban"); // "list" | "kanban"

  // Filters
  const [dueFilter, setDueFilter] = useState("all"); // all | overdue | today | this_week
  const [assigneeFilter, setAssigneeFilter] = useState("all"); // all | me | <userId>
  const [projectFilter, setProjectFilter] = useState(searchParams.get("projectId") || "all");
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);

  // UX controls
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  // Technician detection
  const isTechnician = user?.is_field_technician && user?.role !== "admin";

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    const projectId = searchParams.get("projectId");
    if (projectId && projectId !== projectFilter) setProjectFilter(projectId);
  }, [searchParams]);

  /* -------------------- Queries -------------------- */
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date"),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  /* -------------------- Mutations -------------------- */
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowCreateModal(false);
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated");
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTask(null);
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const handleToggleComplete = async (task) => {
    const newStatus = task.status === "Completed" ? "Open" : "Completed";
    updateMutation.mutate({
      id: task.id,
      data: {
        status: newStatus,
        completed_at: newStatus === "Completed" ? new Date().toISOString() : null,
      },
    });
  };

  const handleMarkComplete = (task) => {
    updateMutation.mutate({
      id: task.id,
      data: {
        status: "Completed",
        completed_at: new Date().toISOString(),
      },
    });
    setSelectedTask(null);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this task?")) deleteMutation.mutate(id);
  };

  /* -------------------- Auto-archive (UI + optional backend mark) -------------------- */
  // Rule: Completed tasks older than 7 days should not show.
  // If the entity has `archived_at`, we *optionally* set it (safe-guarded).
  useEffect(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const now = new Date();
    const toArchive = tasks.filter((t) => {
      if (t.status !== "Completed") return false;
      if (!t.completed_at) return false;
      // already archived in data
      if (t.archived_at) return false;
      const age = differenceInDays(now, new Date(t.completed_at));
      return age > 7;
    });

    if (toArchive.length === 0) return;

    // Only attempt backend write if the field exists on at least one record
    const supportsArchivedAt = toArchive.some((t) => Object.prototype.hasOwnProperty.call(t, "archived_at"));
    if (!supportsArchivedAt) return;

    // Best-effort background mark; ignore failures
    Promise.allSettled(
      toArchive.map((t) =>
        base44.entities.Task.update(t.id, {
          archived_at: new Date().toISOString(),
        }).catch(() => null)
      )
    ).then(() => {
      // don't toast; just refresh quietly
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });
  }, [tasks]);

  /* -------------------- Canonical filtering (applies to LIST + KANBAN) -------------------- */
  const canonicalTasks = useMemo(() => {
    const now = new Date();

    return (tasks || []).filter((task) => {
      // 1) Hide Cancelled everywhere
      if (task.status === "Cancelled") return false;

      // 2) Hide archived (if your schema has it)
      if (task.archived_at) return false;

      // 3) Auto-archive rule (UI enforcement): Completed older than 7 days => hidden
      if (task.status === "Completed" && task.completed_at) {
        const age = differenceInDays(now, new Date(task.completed_at));
        if (age > 7) return false;
      }

      // 4) Technician: only assigned tasks
      if (isTechnician && user?.id && task.assigned_to_user_id !== user.id) return false;

      return true;
    });
  }, [tasks, isTechnician, user?.id]);

  /* -------------------- Filtered tasks -------------------- */
  const filteredTasks = useMemo(() => {
    const filtered = canonicalTasks.filter((task) => {
      // Project filter
      if (projectFilter !== "all" && task.project_id !== projectFilter) return false;

      // Due filter
      if (dueFilter !== "all") {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);

        if (dueFilter === "overdue" && !isPast(dueDate)) return false;
        if (dueFilter === "today" && !isToday(dueDate)) return false;
        if (dueFilter === "this_week" && !isThisWeek(dueDate, { weekStartsOn: 1 })) return false;
      }

      // Assignee filter (admin/manager UX)
      if (assigneeFilter === "me" && user?.id && task.assigned_to_user_id !== user.id) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "me" && task.assigned_to_user_id !== assigneeFilter) {
        return false;
      }

      return true;
    });

    // Optional: If filtering by project, sort by urgency
    if (projectFilter !== "all") {
      const now = new Date();
      return filtered.sort((a, b) => {
        const aDate = a.due_date ? new Date(a.due_date) : null;
        const bDate = b.due_date ? new Date(b.due_date) : null;

        const aOverdue = aDate && isPast(aDate);
        const bOverdue = bDate && isPast(bDate);
        const aToday = aDate && isToday(aDate);
        const bToday = bDate && isToday(bDate);
        const aDueSoon =
          aDate &&
          !isPast(aDate) &&
          !isToday(aDate) &&
          aDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const bDueSoon =
          bDate &&
          !isPast(bDate) &&
          !isToday(bDate) &&
          bDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (aToday && !bToday) return -1;
        if (!aToday && bToday) return 1;
        if (aDueSoon && !bDueSoon) return -1;
        if (!aDueSoon && bDueSoon) return 1;

        if (aDate && bDate) return aDate - bDate;
        if (aDate) return -1;
        if (bDate) return 1;
        return 0;
      });
    }

    return filtered;
  }, [canonicalTasks, projectFilter, dueFilter, assigneeFilter, user?.id]);

  /* -------------------- Completed preview (LIST only) -------------------- */
  const listOpenTasks = useMemo(
    () => filteredTasks.filter((t) => t.status !== "Completed"),
    [filteredTasks]
  );

  const listCompletedTasks = useMemo(() => {
    return filteredTasks
      .filter((t) => t.status === "Completed")
      .sort((a, b) => {
        const aTs = new Date(a.completed_at || a.updated_date || a.created_date || 0).getTime();
        const bTs = new Date(b.completed_at || b.updated_date || b.created_date || 0).getTime();
        return bTs - aTs;
      });
  }, [filteredTasks]);

  const completedPreview = useMemo(() => {
    if (showAllCompleted) return listCompletedTasks;
    return listCompletedTasks.slice(0, 5);
  }, [listCompletedTasks, showAllCompleted]);

  /* -------------------- Enrich assignee name -------------------- */
  const withAssigneeName = (t) => {
    const assignee = users.find((u) => u.id === t.assigned_to_user_id);
    return {
      ...t,
      assigned_to_name: assignee ? assignee.display_name || assignee.full_name : t.assigned_to_name,
    };
  };

  /* -------------------- Render -------------------- */
  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-[#111827]">Tasks</h1>
            <p className="text-sm text-[#6B7280] mt-1">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
              {listCompletedTasks.length > 0 && (
                <span className="ml-2 text-[#9CA3AF]">
                  • {Math.min(5, listCompletedTasks.length)} shown in Completed (auto-archives after 7 days)
                </span>
              )}
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

        {/* Filters row */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 flex-1">
            {/* My Tasks Quick Filter */}
            <Button
              variant={assigneeFilter === "me" ? "default" : "outline"}
              onClick={() => setAssigneeFilter(assigneeFilter === "me" ? "all" : "me")}
              className={assigneeFilter === "me" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}
            >
              <Filter className="w-4 h-4 mr-2" />
              My Tasks
            </Button>

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
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name || u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectSearchOpen}
                  className="w-full lg:w-[220px] justify-between"
                >
                  {projectFilter === "all"
                    ? "All Projects"
                    : projects.find((p) => p.id === projectFilter)?.title
                      ? `#${projects.find((p) => p.id === projectFilter)?.project_number} ${projects.find((p) => p.id === projectFilter)?.title}`
                      : "Select project..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search projects..." />
                  <CommandList>
                    <CommandEmpty>No project found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setProjectFilter("all");
                          setProjectSearchOpen(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${projectFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                        All Projects
                      </CommandItem>
                      {projects.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.project_number} ${p.title}`}
                          onSelect={() => {
                            setProjectFilter(p.id);
                            setProjectSearchOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${projectFilter === p.id ? "opacity-100" : "opacity-0"}`} />
                          #{p.project_number} {p.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-[#E5E7EB]">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" />
            <p className="text-[#6B7280] mb-4">No tasks found</p>
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create your first task
            </Button>
          </div>
        ) : viewMode === "kanban" ? (
          <TaskKanbanView
            tasks={filteredTasks.map(withAssigneeName)}
            users={users}
            onTaskClick={setSelectedTask}
            onToggleComplete={handleToggleComplete}
            onTaskUpdate={(id, data) => updateMutation.mutate({ id, data })}
            // Best-effort hints (safe if unused by component)
            hiddenStatuses={["Cancelled"]}
          />
        ) : (
          <div className="space-y-4">
            {/* OPEN / IN PROGRESS */}
            {listOpenTasks.length > 0 && (
              <div className="space-y-3">
                {listOpenTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={withAssigneeName(task)}
                    onClick={setSelectedTask}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </div>
            )}

            {/* COMPLETED (preview with see more) */}
            {listCompletedTasks.length > 0 && (
              <div className="mt-4 bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <button
                  onClick={() => setShowAllCompleted((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#16A34A]" />
                    <span className="text-sm font-semibold text-[#111827]">
                      Completed
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      (showing {Math.min(5, listCompletedTasks.length)} of {listCompletedTasks.length})
                    </span>
                    <span className="ml-2 text-xs text-[#9CA3AF]">
                      Auto-archives after 7 days
                    </span>
                  </div>
                  {showAllCompleted ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>

                <div className="p-3 space-y-3">
                  {completedPreview.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={withAssigneeName(task)}
                      onClick={setSelectedTask}
                      onToggleComplete={handleToggleComplete}
                    />
                  ))}

                  {listCompletedTasks.length > 5 && !showAllCompleted && (
                    <div className="pt-2 flex justify-center">
                      <Button variant="outline" onClick={() => setShowAllCompleted(true)}>
                        See more completed
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty open state (but completed exists) */}
            {listOpenTasks.length === 0 && listCompletedTasks.length > 0 && (
              <div className="text-center py-10 text-sm text-[#6B7280]">
                No open tasks. Only completed tasks are showing.
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