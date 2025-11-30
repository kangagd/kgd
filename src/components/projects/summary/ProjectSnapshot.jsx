import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, MapPin, User, Calendar, DollarSign, Shield, Edit2, Save, X } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ProjectTypeBadge } from "../../common/StatusBadge";

export default function ProjectSnapshot({ project, summary, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [estimatedDate, setEstimatedDate] = useState(
        project.status === 'Completed' 
            ? (project.completed_date || "") 
            : (project.estimated_completion_date || "")
    );
    
    const handleSave = async () => {
        try {
            const updateData = {};
            if (project.status === 'Completed') {
                updateData.completed_date = estimatedDate || null;
            } else {
                updateData.estimated_completion_date = estimatedDate || null;
            }

            await base44.entities.Project.update(project.id, updateData);
            
            // Recalculate warranty if completed date changed
            if (project.status === 'Completed' && updateData.completed_date) {
                await base44.functions.invoke('project_calculateWarranty', { projectId: project.id });
            }

            setIsEditing(false);
            onUpdate?.();
            toast.success("Updated project details");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update");
        }
    };

    const completionPercentage = summary.totalJobs > 0 
        ? Math.round((summary.completedJobs / summary.totalJobs) * 100) 
        : 0;

    return (
        <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1 space-y-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h2 className="text-xl font-bold text-slate-900">{project.title}</h2>
                                <ProjectTypeBadge value={project.project_type} />
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                <User className="w-4 h-4" />
                                <span className="font-medium text-slate-700">{project.customer_name}</span>
                                {project.organisation_id && <span className="text-slate-400">• Org Linked</span>}
                            </div>
                            {project.address && (
                                <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                                    <MapPin className="w-4 h-4" />
                                    {project.address}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                             <div className="px-3 py-2 bg-slate-50 rounded border border-slate-100">
                                <span className="text-xs text-slate-400 uppercase font-bold block mb-0.5">Status</span>
                                <Badge variant="outline" className="bg-white">{project.status}</Badge>
                             </div>
                             <div className="px-3 py-2 bg-slate-50 rounded border border-slate-100 relative group min-w-[140px]">
                                <span className="text-xs text-slate-400 uppercase font-bold block mb-0.5">
                                    {project.status === 'Completed' ? 'Completed Date' : 'Est. Completion'}
                                </span>
                                {isEditing ? (
                                    <div className="flex items-center gap-1">
                                        <Input 
                                            type="date" 
                                            className="h-6 text-xs p-1 w-24"
                                            value={estimatedDate}
                                            onChange={(e) => setEstimatedDate(e.target.value)}
                                        />
                                        <button onClick={handleSave} className="text-green-600"><Save className="w-4 h-4" /></button>
                                        <button onClick={() => setIsEditing(false)} className="text-slate-400"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsEditing(true)}>
                                        <span className="text-sm font-medium text-slate-700">
                                            {project.status === 'Completed' 
                                                ? (project.completed_date ? format(new Date(project.completed_date), 'MMM d, yyyy') : 'Set Date')
                                                : (project.estimated_completion_date ? format(new Date(project.estimated_completion_date), 'MMM d, yyyy') : 'Set Date')
                                            }
                                        </span>
                                        <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                                    </div>
                                )}
                             </div>
                             <div className="px-3 py-2 bg-slate-50 rounded border border-slate-100">
                                <span className="text-xs text-slate-400 uppercase font-bold block mb-0.5">Project Value</span>
                                <div className="flex items-center gap-1 text-sm font-medium text-slate-700">
                                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                                    {summary.projectValue?.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }) || '$0.00'}
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* Right Side Stats */}
                    <div className="w-full md:w-64 flex-shrink-0 space-y-4 border-l pl-6 border-slate-100">
                         <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Progress</span>
                                <span className="font-medium text-slate-700">{completionPercentage}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-slate-900 rounded-full transition-all duration-500" 
                                    style={{ width: `${completionPercentage}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>{summary.completedJobs} Completed</span>
                                <span>{summary.totalJobs} Total</span>
                            </div>
                         </div>
                         
                         {project.warranty_enabled && (
                             <div className="flex items-center gap-3 p-3 rounded bg-slate-50 border border-slate-100">
                                <Shield className={`w-5 h-5 ${project.warranty_status === 'Active' ? 'text-green-500' : 'text-slate-400'}`} />
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Warranty</span>
                                    <span className={`text-sm font-medium ${
                                        project.warranty_status === 'Active' ? 'text-green-700' : 
                                        project.warranty_status === 'Void' ? 'text-red-700' : 'text-slate-600'
                                    }`}>
                                        {project.warranty_status || 'None'}
                                    </span>
                                </div>
                             </div>
                         )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}