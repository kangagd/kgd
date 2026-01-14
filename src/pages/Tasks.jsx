import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Loader2,
  Calendar,
  LayoutList,
  Columns,
  ChevronsUpDown,
} from "lucide-react";
import {
  isPast,
  isToday,
  isThisWeek,
  startOfDay,
  differenceInDays,
} from "date-fns";
import TaskCard from "../components/tasks/TaskCard";
import TaskFormModal from "../components/tasks/TaskFormModal";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import TaskKanbanView from "../components/tasks/TaskKanbanView";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

/* ---------------- constants ---------------- */
const COMPLETED_PREVIEW_LIMIT = 5;
const AUTO_ARCHIVE_AFTER_DAYS = 7;
/* ------------------------------------------ */

export default function Tasks() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date"),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  /* ---------- mutations ---------- */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowCreateModal(false);
      toast.success("Task created");
    },
  });

  /* ---------- filtering ---------- */
  const {
    openTasks,
    completedTasksVisible,
    completedTasksTotal,
  } = useMemo(() => {
    const now = new Date();

    const visible = tasks.filter((t) => {
      // 🚫 Never show cancelled
      if (t.status === "Cancelled") return false;

      // 🚫 Auto-archive completed after 7 days
      if (
        t.status === "Completed" &&
        t.completed_at &&
        differenceInDays(now, new Date(t.completed_at)) > AUTO_ARCHIVE_AFTER_DAYS
      ) {
        return false;
      }

      return true;
    });

    const open = visible.filter(
      (t) => t.status !== "Completed"
    );

    const completed = visible
      .filter((t) => t.status === "Completed")
      .sort(
        (a, b) =>
          new Date(b.completed_at || b.updated_date) -
          new Date(a.completed_at || a.updated_date)
      );

    return {
      openTasks: open,
      completedTasksVisible: showAllCompleted
        ? completed
        : completed.slice(0, COMPLETED_PREVIEW_LIMIT),
      completedTasksTotal: completed.length,
    };
  }, [tasks, showAllCompleted]);

  /* ---------- handlers ---------- */
  const handleToggleComplete = (task) => {
    const isCompleting = task.status !== "Completed";
    updateMutation.mutate({
      id: task.id,
      data: {
        status: isCompleting ? "Completed" : "Open",
        completed_at: isCompleting ? new Date().toISOString() : null,
      },
    });
  };

  /* ---------- render ---------- */
  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">

        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-[#111827]">Tasks</h1>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        </div>

        {/* OPEN TASKS */}
        {openTasks.length > 0 && (
          <div className="space-y-3 mb-8">
            {openTasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigned_to_user_id);
              return (
                <TaskCard
                  key={task.id}
                  task={{
                    ...task,
                    assigned_to_name:
                      assignee?.display_name || assignee?.full_name,
                  }}
                  onClick={setSelectedTask}
                  onToggleComplete={handleToggleComplete}
                />
              );
            })}
          </div>
        )}

        {/* COMPLETED PREVIEW */}
        {completedTasksTotal > 0 && (
          <div className="border-t border-[#E5E7EB] pt-6 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#6B7280]">
                Completed
              </h3>
              {completedTasksTotal > COMPLETED_PREVIEW_LIMIT && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllCompleted((v) => !v)}
                >
                  {showAllCompleted
                    ? "Hide completed"
                    : `See completed (${completedTasksTotal})`}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {completedTasksVisible.map((task) => {
                const assignee = users.find((u) => u.id === task.assigned_to_user_id);
                return (
                  <TaskCard
                    key={task.id}
                    task={{
                      ...task,
                      assigned_to_name:
                        assignee?.display_name || assignee?.full_name,
                    }}
                    onClick={setSelectedTask}
                    onToggleComplete={handleToggleComplete}
                    muted
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && openTasks.length === 0 && (
          <div className="text-center py-16 text-[#6B7280]">
            No open tasks 🎉
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
          onMarkComplete={handleToggleComplete}
        />
      </div>
    </div>
  );
}
