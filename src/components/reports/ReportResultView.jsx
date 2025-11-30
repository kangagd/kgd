import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

export default function ReportResultView({ result, reportName, open, onClose, isLoading }) {
    if (!open) return null;

    const data = result?.data_json ? JSON.parse(result.data_json) : [];
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    const downloadCSV = () => {
        if (!data.length) return;
        const header = columns.join(",");
        const rows = data.map(row => columns.map(col => `"${row[col]}"`).join(","));
        const csv = [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName || 'report'}_${new Date().toISOString()}.csv`;
        a.click();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>{reportName} - Results</DialogTitle>
                    {!isLoading && data.length > 0 && (
                        <Button size="sm" variant="outline" onClick={downloadCSV} className="gap-2 mr-8">
                            <Download className="w-4 h-4" />
                            Download CSV
                        </Button>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                            <span className="ml-2 text-slate-500">Generating report...</span>
                        </div>
                    ) : data.length > 0 ? (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {columns.map(col => (
                                            <TableHead key={col} className="capitalize">{col.replace(/_/g, ' ')}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((row, idx) => (
                                        <TableRow key={idx}>
                                            {columns.map(col => (
                                                <TableCell key={col}>{row[col]}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            No data found matching filters.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}