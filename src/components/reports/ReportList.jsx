import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, FileDown, Table as TableIcon, Calendar, MoreHorizontal, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function ReportList({ reports, onRun, onEdit, onViewHistory }) {
  const queryClient = useQueryClient();

  const deleteReportMutation = useMutation({
    mutationFn: (id) => base44.entities.ReportDefinition.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] });
      toast.success("Report deleted");
    }
  });

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <Card key={report.id} className="border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {report.entity_type} Report
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(report)}>
                  Edit Definition
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewHistory(report)}>
                  View History
                </DropdownMenuItem>
                <DropdownMenuItem 
                    className="text-red-600"
                    onClick={() => {
                        if(confirm("Are you sure?")) deleteReportMutation.mutate(report.id);
                    }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">{report.name}</div>
            <p className="text-xs text-slate-500 mb-4 h-10 line-clamp-2">
              {report.description || "No description"}
            </p>
            
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                <Calendar className="w-3 h-3" />
                {report.schedule ? `Scheduled: ${report.schedule}` : 'Manual run only'}
            </div>

            <div className="flex gap-2">
                <Button 
                    className="flex-1 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                    size="sm"
                    onClick={() => onRun(report)}
                >
                    <Play className="w-3 h-3 mr-2" />
                    Run Now
                </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <Card className="border border-dashed border-slate-300 shadow-none flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-slate-50 transition-all" onClick={() => onEdit(null)}>
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-slate-600" />
        </div>
        <h3 className="font-medium text-slate-900">Create Report</h3>
        <p className="text-xs text-slate-500 text-center mt-1">Custom filters & columns</p>
      </Card>
    </div>
  );
}