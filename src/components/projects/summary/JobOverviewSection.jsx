import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, ExternalLink, Calendar, User, CheckCircle2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function JobOverviewSection({ jobs, summary }) {
    const navigate = useNavigate();

    return (
        <Collapsible defaultOpen className="border border-slate-200 rounded-lg bg-white shadow-sm">
            <CollapsibleTrigger className="w-full">
                <CardHeader className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-slate-500" />
                        <CardTitle className="text-base font-semibold text-slate-800">Job Overview</CardTitle>
                        <Badge variant="secondary" className="bg-white border-slate-200 text-slate-600 font-normal">
                            {summary.completedJobs} / {summary.totalJobs} Completed
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                         <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(createPageUrl("Schedule"));
                            }}
                            className="h-8 text-slate-600 hover:bg-white"
                         >
                            Go to Schedule <ExternalLink className="w-3 h-3 ml-2" />
                         </Button>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Job #</th>
                                    <th className="px-4 py-3 font-medium">Type</th>
                                    <th className="px-4 py-3 font-medium">Technician</th>
                                    <th className="px-4 py-3 font-medium">Date & Time</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {jobs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No jobs found</td>
                                    </tr>
                                ) : (
                                    jobs.map(job => (
                                        <tr key={job.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                #{job.job_number}
                                                {job.is_warranty_job && (
                                                    <Badge className="ml-2 bg-purple-50 text-purple-700 border-purple-100 text-[10px] px-1.5 py-0">
                                                        Warranty
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{job.job_type || 'Standard'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    {job.assigned_to_name?.join(', ') || 'Unassigned'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                    {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'Unscheduled'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className={
                                                    job.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    job.status === 'Scheduled' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    'bg-slate-50 text-slate-600'
                                                }>
                                                    {job.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => navigate(`${createPageUrl("Jobs")}?jobId=${job.id}`)}
                                                    className="h-7"
                                                >
                                                    Open
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </CollapsibleContent>
        </Collapsible>
    );
}