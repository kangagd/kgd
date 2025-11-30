import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, RefreshCcw } from "lucide-react";

export default function StageHistoryTab({ projectId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['projectStageHistory', projectId],
    queryFn: async () => {
      const records = await base44.entities.ProjectStageHistory.filter(
        { project_id: projectId }, 
        '-changed_at', 
        100
      );
      return records;
    },
    enabled: !!projectId
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Stage History</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No stage history recorded yet.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Old Stage</TableHead>
                  <TableHead>New Stage</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.changed_at), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      {record.old_stage ? (
                        <Badge variant="outline">{record.old_stage}</Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200">
                        {record.new_stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <User className="w-3 h-3" />
                        {record.changed_by || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={record.notes}>
                      {record.notes || <span className="text-slate-400 italic">No notes</span>}
                    </TableCell>
                    <TableCell>
                      {record.automatic ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <RefreshCcw className="w-3 h-3" /> Auto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}