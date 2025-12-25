import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Plus, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TaskFormModal from "../tasks/TaskFormModal";

export default function TasksCompactCard({ tasks = [], onViewAll, onAddTask, entityType = 'project', entityId, entityName, customerId, customerName }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const activeTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
  
  const dueToday = activeTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    return dueDateOnly.getTime() === today.getTime();
  }).length;

  const overdue = activeTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate < today;
  }).length;

  const dueSoon = activeTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const daysUntilDue = Math.ceil((dueDateOnly - today) / (1000 * 60 * 60 * 24));
    return daysUntilDue > 0 && daysUntilDue <= 3;
  }).length;

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle 
          onClick={(e) => {
            e.stopPropagation();
            if (onViewAll) onViewAll();
          }}
          className="text-[16px] font-semibold text-[#111827] cursor-pointer hover:underline"
        >
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Compact Stats */}
        <div className="flex items-center gap-3 text-[13px]">
          {overdue > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[#4B5563]">Overdue:</span>
              <span className="font-semibold text-red-700">{overdue}</span>
            </div>
          )}
          {dueToday > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span className="text-[#4B5563]">Due today:</span>
              <span className="font-semibold text-orange-700">{dueToday}</span>
            </div>
          )}
          {dueSoon > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-[#4B5563]">Due soon:</span>
              <span className="font-semibold text-yellow-700">{dueSoon}</span>
            </div>
          )}
          {overdue === 0 && dueToday === 0 && dueSoon === 0 && (
            <span className="text-[#9CA3AF]">No urgent tasks</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewAll?.();
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
          if (onAddTask) onAddTask(data);
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
    </Card>
  );
}