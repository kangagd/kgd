import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const ENTITY_TYPES = ["Job", "Project", "Customer", "Invoice", "Part"];

const AVAILABLE_COLUMNS = {
    "Job": [
        { key: "job_number", label: "Job #" },
        { key: "customer_name", label: "Customer" },
        { key: "status", label: "Status" },
        { key: "scheduled_date", label: "Date" },
        { key: "job_type", label: "Type" },
        { key: "technician_name", label: "Technician" }
    ],
    "Project": [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "customer_name", label: "Customer" },
        { key: "quote_value", label: "Value" },
        { key: "created_date", label: "Created" }
    ],
    // Add others...
};

export default function ReportBuilder({ report, open, onClose }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState(report || {
        name: "",
        description: "",
        entity_type: "Job",
        filters: { status: "all", date_range: "last_30_days" },
        columns: [],
        schedule: "",
        output_type: "UI"
    });

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (data.id) return base44.entities.ReportDefinition.update(data.id, data);
            return base44.entities.ReportDefinition.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] });
            toast.success("Report definition saved");
            onClose();
        }
    });

    const handleColumnToggle = (col) => {
        const exists = formData.columns.find(c => c.key === col.key);
        if (exists) {
            setFormData({ ...formData, columns: formData.columns.filter(c => c.key !== col.key) });
        } else {
            setFormData({ ...formData, columns: [...formData.columns, col] });
        }
    };

    const availableCols = AVAILABLE_COLUMNS[formData.entity_type] || [];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{report ? 'Edit Report' : 'Create New Report'}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Report Name</Label>
                            <Input 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                placeholder="e.g. Weekly Jobs"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Entity Type</Label>
                            <Select 
                                value={formData.entity_type} 
                                onValueChange={v => setFormData({...formData, entity_type: v, columns: []})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Input 
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                        />
                    </div>

                    <div className="space-y-2 p-4 bg-slate-50 rounded-lg border">
                        <Label className="mb-2 block font-bold">Filters</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Date Range</Label>
                                <Select 
                                    value={formData.filters.date_range} 
                                    onValueChange={v => setFormData({...formData, filters: {...formData.filters, date_range: v}})}
                                >
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Time</SelectItem>
                                        <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                                        <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                                        <SelectItem value="this_month">This Month</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Dynamic status filter based on entity could go here */}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Columns</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {availableCols.map(col => (
                                <div key={col.key} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`col-${col.key}`} 
                                        checked={formData.columns.some(c => c.key === col.key)}
                                        onCheckedChange={() => handleColumnToggle(col)}
                                    />
                                    <label
                                        htmlFor={`col-${col.key}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {col.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Schedule (Cron)</Label>
                            <Input 
                                value={formData.schedule} 
                                onChange={e => setFormData({...formData, schedule: e.target.value})} 
                                placeholder="0 9 * * 1"
                            />
                            <p className="text-[10px] text-slate-500">Format: min hour day month dow</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Output Format</Label>
                            <Select 
                                value={formData.output_type} 
                                onValueChange={v => setFormData({...formData, output_type: v})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UI">UI Table</SelectItem>
                                    <SelectItem value="CSV">CSV Download</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button 
                        onClick={() => saveMutation.mutate(formData)} 
                        disabled={!formData.name || !formData.entity_type || saveMutation.isPending}
                    >
                        {saveMutation.isPending ? 'Saving...' : 'Save Definition'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}