import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Plus, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TasksCompactCard({ tasks = [], onViewAll, onAddTask }) {
  const now = new Date();
  const dueSoon = tasks.filter(t => {
    if (t.status === 'Completed' || t.status === 'Cancelled') return false;
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    return daysUntilDue >= 0 && daysUntilDue <= 3;
  }).length;

  const overdue = tasks.filter(t => {
    if (t.status === 'Completed' || t.status === 'Cancelled') return false;
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate < now;
  }).length;

  const activeTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length;

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[16px] font-semibold text-[#111827]">Tasks</CardTitle>
          <Badge variant="secondary" className="text-[11px]">
            {activeTasks} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          {overdue > 0 && (
            <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <div>
                <div className="text-[11px] text-red-700 font-medium">Overdue</div>
                <div className="text-[16px] font-bold text-red-700">{overdue}</div>
              </div>
            </div>
          )}
          {dueSoon > 0 && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
              <Clock className="w-4 h-4 text-yellow-700" />
              <div>
                <div className="text-[11px] text-yellow-800 font-medium">Due Soon</div>
                <div className="text-[16px] font-bold text-yellow-800">{dueSoon}</div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onViewAll}
            variant="outline"
            size="sm"
            className="flex-1 text-[13px]"
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            View All
          </Button>
          <Button
            onClick={onAddTask}
            size="sm"
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] text-[13px]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}