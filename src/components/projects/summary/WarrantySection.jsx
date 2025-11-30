import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Plus, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import SubmitWarrantyIssueModal from "./SubmitWarrantyIssueModal";
import ReviewWarrantyIssueModal from "./ReviewWarrantyIssueModal";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function WarrantySection({ project, warrantyIssues, warrantyJobs, onUpdate }) {
    const [isSubmitOpen, setIsSubmitOpen] = useState(false);
    const [reviewIssue, setReviewIssue] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    React.useEffect(() => {
        base44.auth.me().then(u => setIsAdmin(u?.role === 'admin' || u?.role === 'manager'));
    }, []);

    const status = project.warranty_status || 'None';
    const expiryDate = project.warranty_expiry_date;
    
    const getStatusBadge = () => {
        switch (status) {
            case 'Active':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
            case 'Expired':
                return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Expired</Badge>;
            case 'Void':
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Void</Badge>;
            default:
                return <Badge variant="outline" className="text-slate-500">None</Badge>;
        }
    };

    const handleVoidWarranty = async () => {
        if (!confirm("Are you sure you want to VOID the warranty? This cannot be undone easily.")) return;
        try {
            await base44.entities.Project.update(project.id, { warranty_status: 'Void' });
            onUpdate?.();
            toast.success("Warranty voided");
        } catch (err) {
            toast.error("Failed to void warranty");
        }
    };

    if (status === 'None') {
        return (
            <Card className="border border-slate-200 bg-slate-50">
                <CardContent className="p-6 text-center">
                    <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-700">Warranty Not Active</h3>
                    <p className="text-slate-500 mt-1 text-sm">Warranty begins automatically when project is marked Completed.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Collapsible defaultOpen className="border border-slate-200 rounded-lg bg-white shadow-sm">
            <CollapsibleTrigger className="w-full">
                <CardHeader className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className={`w-5 h-5 ${status === 'Active' ? 'text-green-600' : 'text-slate-400'}`} />
                        <CardTitle className="text-base font-semibold text-slate-800">Warranty</CardTitle>
                        {getStatusBadge()}
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <CardContent className="p-4 space-y-6">
                    {/* Status Card */}
                    <div className={`rounded-lg p-4 border ${status === 'Active' ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm text-slate-500 uppercase font-medium mb-1">Warranty Expiry</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {expiryDate ? format(new Date(expiryDate), 'MMMM d, yyyy') : 'N/A'}
                                </div>
                                {project.warranty_notes && (
                                    <p className="text-sm text-slate-600 mt-2 italic">{project.warranty_notes}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                {status === 'Active' && (
                                    <Button size="sm" onClick={() => setIsSubmitOpen(true)} className="bg-white text-slate-700 border hover:bg-slate-50 shadow-sm">
                                        <AlertTriangle className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                        Report Issue
                                    </Button>
                                )}
                                {isAdmin && status === 'Active' && (
                                    <Button size="sm" variant="ghost" onClick={handleVoidWarranty} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                        Void Warranty
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Issues List */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Warranty Issues</h4>
                        {warrantyIssues.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No issues reported.</p>
                        ) : (
                            <div className="space-y-2">
                                {warrantyIssues.map(issue => (
                                    <div key={issue.id} className="flex items-center justify-between p-3 rounded border border-slate-100 hover:bg-slate-50">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={
                                                    issue.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    issue.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    issue.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                                                    'bg-slate-50 text-slate-600'
                                                }>
                                                    {issue.status}
                                                </Badge>
                                                <span className="text-xs text-slate-400">{format(new Date(issue.reported_at), 'MMM d')}</span>
                                            </div>
                                            <p className="text-sm text-slate-800 line-clamp-1">{issue.description}</p>
                                        </div>
                                        {isAdmin && (issue.status === 'New' || issue.status === 'In Review') && (
                                            <Button size="sm" variant="outline" onClick={() => setReviewIssue(issue)}>Review</Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Warranty Jobs */}
                    {warrantyJobs.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3">Warranty Visits</h4>
                            <div className="space-y-2">
                                {warrantyJobs.map(job => (
                                    <div key={job.id} className="flex items-center justify-between p-3 rounded border border-slate-100 bg-slate-50">
                                        <div>
                                            <div className="font-medium text-sm text-slate-900">#{job.job_number} - Warranty Visit</div>
                                            <div className="text-xs text-slate-500">{job.status} • {job.scheduled_date || 'Unscheduled'}</div>
                                        </div>
                                        <a href={`${createPageUrl("Jobs")}?jobId=${job.id}`} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="ghost">
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </CollapsibleContent>

            <SubmitWarrantyIssueModal 
                isOpen={isSubmitOpen} 
                onClose={() => setIsSubmitOpen(false)} 
                projectId={project.id}
                onSubmitted={onUpdate}
            />

            <ReviewWarrantyIssueModal
                isOpen={!!reviewIssue}
                onClose={() => setReviewIssue(null)}
                issue={reviewIssue}
                onResolved={onUpdate}
            />
        </Collapsible>
    );
}