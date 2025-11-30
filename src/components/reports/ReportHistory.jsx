import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export default function ReportHistory({ report, results, open, onClose, onViewResult }) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Run History: {report?.name}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Rows</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map(res => (
                                <TableRow key={res.id}>
                                    <TableCell>{format(parseISO(res.generated_at), 'MMM d, yyyy HH:mm')}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${
                                            res.status === 'success' ? 'bg-green-100 text-green-800' : 
                                            res.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                            'bg-slate-100'
                                        }`}>
                                            {res.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>{res.row_count}</TableCell>
                                    <TableCell className="text-right">
                                        {res.status === 'success' && (
                                            <Button size="sm" variant="ghost" onClick={() => onViewResult(res)}>
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {results.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4 text-slate-500">
                                        No history available
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}