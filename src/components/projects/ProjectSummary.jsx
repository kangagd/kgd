import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, User, FileText, ArrowRight, Briefcase, DollarSign, ShoppingCart, Wrench, Plus, ExternalLink, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ProjectStatusBadge, FinancialStatusBadge } from "../common/StatusBadge";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";

export default function ProjectSummary({ project, jobs, onTabChange }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch Quotes
  const { data: quotes = [] } = useQuery({
    queryKey: ['projectQuotes', project.id],
    queryFn: () => base44.entities.Quote.filter({ project_id: project.id }, '-created_date', 2),
    enabled: !!project.id
  });

  // Fetch Parts stats
  const { data: partsStats } = useQuery({
    queryKey: ['projectPartsStats', project.id],
    queryFn: async () => {
      const parts = await base44.entities.Part.filter({ project_id: project.id });
      const statusCounts = parts.reduce((acc, part) => {
        acc[part.status] = (acc[part.status] || 0) + 1;
        return acc;
      }, {});
      const logisticsCount = parts.filter(p => p.linked_logistics_jobs?.length > 0).length;
      return { statusCounts, logisticsCount, total: parts.length };
    },
    enabled: !!project.id
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('manageProject', { action: 'update', id: project.id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    }
  });

  const handleMarkWarrantyComplete = () => {
    if (confirm("Are you sure you want to mark the warranty as complete? This will set the project status back to Completed.")) {
      updateProjectMutation.mutate({
        warranty_status: 'Warranty Completed',
        is_in_warranty: false,
        status: 'Completed'
      });
    }
  };

  const handleCreateWarrantyJob = () => {
    navigate(`${createPageUrl("Jobs")}?action=new&projectId=${project.id}&status=Scheduled&jobCategory=Standard&isWarranty=true`);
  };

  // Derived Data
  const nextScheduledJob = jobs
    .filter(j => j.status === 'Scheduled' && new Date(j.scheduled_date) >= new Date())
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0];

  const lastVisitJob = jobs
    .filter(j => j.status === 'Completed')
    .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))[0];

  const openWarrantyJobs = jobs.filter(j => j.is_warranty_job && j.status !== 'Completed' && j.status !== 'Cancelled');

  const warrantyStatusColor = {
    "Not Started": "bg-slate-100 text-slate-700",
    "In Warranty": "bg-amber-100 text-amber-800",
    "Warranty Completed": "bg-green-100 text-green-800",
    "Warranty Expired": "bg-slate-100 text-slate-500"
  }[project.warranty_status] || "bg-slate-100 text-slate-700";

  const financialStatus = project.financial_status || "No payments";

  return (
    <div className="space-y-6">
      {/* Top Row: Status Chips */}
      <div className="flex flex-wrap gap-3">
        <ProjectStatusBadge status={project.status} className="text-sm px-3 py-1" />
        <FinancialStatusBadge status={financialStatus} className="text-sm px-3 py-1" />
        <Badge className={`${warrantyStatusColor} hover:${warrantyStatusColor} border-0 text-sm px-3 py-1 rounded-lg shadow-sm`}>
            {project.is_in_warranty ? <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
            {project.warranty_status || "Not Started"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: At a Glance */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-xl h-full">
          <CardHeader className="bg-slate-50 px-4 py-3 border-b border-[#E5E7EB]">
             <CardTitle className="text-base font-semibold text-[#111827]">At a Glance</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
             <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                <span className="text-slate-500 font-medium">Type</span>
                <span className="text-[#111827] font-medium">{project.project_type || "N/A"}</span>

                <span className="text-slate-500 font-medium">Customer</span>
                <span className="text-[#111827]">{project.customer_name}</span>

                <span className="text-slate-500 font-medium">Address</span>
                {project.address ? (
                     <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-start gap-1"
                     >
                        <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {project.address}
                     </a>
                ) : <span className="text-slate-400">No address</span>}

                <span className="text-slate-500 font-medium">Contract</span>
                {project.contract_id ? (
                    <Link to={`${createPageUrl("Contracts")}?contractId=${project.contract_id}`} className="text-blue-600 hover:underline">
                        View Contract
                    </Link>
                ) : <span className="text-slate-400">None</span>}

                <span className="text-slate-500 font-medium">Created</span>
                <span className="text-[#111827]">{new Date(project.created_date).toLocaleDateString()}</span>

                <span className="text-slate-500 font-medium">Completed</span>
                <span className="text-[#111827]">{project.completed_date ? new Date(project.completed_date).toLocaleDateString() : "-"}</span>
                
                {project.primary_quote_id && (
                    <>
                        <span className="text-slate-500 font-medium">Primary Quote</span>
                        <Link to="#" onClick={(e) => { e.preventDefault(); onTabChange("quotes"); }} className="text-blue-600 hover:underline flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            View Quote
                        </Link>
                    </>
                )}
             </div>
          </CardContent>
        </Card>

        {/* Card 2: Schedule & Visits */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-xl h-full flex flex-col">
          <CardHeader className="bg-slate-50 px-4 py-3 border-b border-[#E5E7EB] flex flex-row justify-between items-center">
             <CardTitle className="text-base font-semibold text-[#111827]">Schedule & Visits</CardTitle>
             <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`${createPageUrl("Jobs")}?action=new&projectId=${project.id}`)}>
                New Visit
             </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
             {/* Next Job */}
             <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Next Scheduled</h4>
                {nextScheduledJob ? (
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <div className="flex justify-between items-start mb-1">
                             <div className="font-medium text-blue-900 text-sm">{new Date(nextScheduledJob.scheduled_date).toLocaleDateString()}</div>
                             <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 text-xs">{nextScheduledJob.scheduled_time || "Time TBD"}</Badge>
                        </div>
                        <div className="text-sm text-blue-800 mb-2">{nextScheduledJob.job_type_name || "Visit"}</div>
                        <TechnicianAvatarGroup technicians={nextScheduledJob.assigned_to} size="sm" />
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 italic">No upcoming visits scheduled</div>
                )}
             </div>

             {/* Last Visit */}
             <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Completed</h4>
                {lastVisitJob ? (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="font-medium text-slate-900 text-sm">{new Date(lastVisitJob.scheduled_date).toLocaleDateString()}</div>
                        <div className="text-sm text-slate-700">{lastVisitJob.job_type_name}</div>
                        {lastVisitJob.outcome && <div className="text-xs text-slate-500 mt-1">Outcome: {lastVisitJob.outcome}</div>}
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 italic">No completed visits yet</div>
                )}
             </div>

             <div className="pt-2">
                <Button variant="ghost" className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 text-sm" onClick={() => onTabChange("visits")}>
                    View all visits <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
             </div>
          </CardContent>
        </Card>

        {/* Card 6: Warranty */}
        <Card className={`border shadow-sm rounded-xl h-full flex flex-col ${project.is_in_warranty ? 'border-amber-200 ring-1 ring-amber-100' : 'border-[#E5E7EB]'}`}>
          <CardHeader className={`${project.is_in_warranty ? 'bg-amber-50' : 'bg-slate-50'} px-4 py-3 border-b border-[#E5E7EB]`}>
             <CardTitle className="text-base font-semibold text-[#111827] flex items-center gap-2">
                Warranty
                {project.is_in_warranty && <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200 border-0 text-[10px] px-1.5 py-0 h-5">Active</Badge>}
             </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
             <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                <span className="text-slate-500 font-medium">Status</span>
                <span className="font-medium">{project.warranty_status || "Not Started"}</span>

                <span className="text-slate-500 font-medium">Start</span>
                <span>{project.warranty_start_date ? new Date(project.warranty_start_date).toLocaleDateString() : "-"}</span>

                <span className="text-slate-500 font-medium">End</span>
                <span>{project.warranty_end_date ? new Date(project.warranty_end_date).toLocaleDateString() : "-"}</span>
             </div>

             {openWarrantyJobs.length > 0 && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <div className="text-xs font-bold text-amber-800 uppercase mb-1">Open Warranty Jobs</div>
                    {openWarrantyJobs.map(job => (
                        <div key={job.id} className="text-sm text-amber-900 flex justify-between">
                            <span>#{job.job_number} - {job.job_type_name}</span>
                            <span className="font-medium">{job.status}</span>
                        </div>
                    ))}
                </div>
             )}

             <div className="pt-2 space-y-2 mt-auto">
                <Button onClick={handleCreateWarrantyJob} variant="outline" className="w-full border-amber-200 text-amber-900 hover:bg-amber-50">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Warranty Job
                </Button>
                
                {project.warranty_status === 'In Warranty' && openWarrantyJobs.length === 0 && (
                    <Button onClick={handleMarkWarrantyComplete} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Warranty Complete
                    </Button>
                )}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Mini Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Card 3: Financial Snapshot */}
         <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
            <CardHeader className="bg-slate-50 px-4 py-3 border-b border-[#E5E7EB]">
                <CardTitle className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-500" /> Financial Snapshot
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Total Value</span>
                        <span className="text-base font-bold text-[#111827]">${(project.total_project_value || 0).toLocaleString()}</span>
                    </div>
                    {/* We can calculate invoiced/paid if we want, or rely on FinancialsTab logic. For now simple view */}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Invoiced</span>
                        <span className="text-sm font-medium text-[#111827]">
                             {/* Placeholder logic as real logic is complex in FinancialsTab */}
                             <span className="text-xs text-slate-400">(See Financials)</span>
                        </span>
                    </div>
                    <Button variant="link" className="p-0 h-auto text-blue-600 hover:underline text-sm" onClick={() => onTabChange("financials")}>
                        View full financials
                    </Button>
                </div>
            </CardContent>
         </Card>

         {/* Card 4: Quotes Snapshot */}
         <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
            <CardHeader className="bg-slate-50 px-4 py-3 border-b border-[#E5E7EB]">
                <CardTitle className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" /> Recent Quotes
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-3">
                    {quotes.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No quotes created</p>
                    ) : (
                        quotes.map(quote => (
                            <div key={quote.id} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                <div>
                                    <div className="text-sm font-medium text-[#111827]">{quote.name}</div>
                                    <div className="text-xs text-slate-500">{new Date(quote.created_date).toLocaleDateString()}</div>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline" className="text-xs mb-1">{quote.status}</Badge>
                                    <div className="text-xs font-semibold">${quote.value?.toLocaleString()}</div>
                                </div>
                            </div>
                        ))
                    )}
                    {quotes.length > 0 && (
                        <Button variant="link" className="p-0 h-auto text-blue-600 hover:underline text-sm block" onClick={() => onTabChange("quotes")}>
                            View all quotes
                        </Button>
                    )}
                </div>
            </CardContent>
         </Card>

         {/* Card 5: Parts & Logistics */}
         <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
            <CardHeader className="bg-slate-50 px-4 py-3 border-b border-[#E5E7EB]">
                <CardTitle className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-slate-500" /> Parts & Logistics
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                {partsStats ? (
                    <div className="space-y-3">
                        <div className="flex gap-2 flex-wrap">
                             {Object.entries(partsStats.statusCounts || {}).map(([status, count]) => (
                                 <Badge key={status} variant="secondary" className="text-xs font-normal">
                                    {status}: {count}
                                 </Badge>
                             ))}
                             {partsStats.total === 0 && <p className="text-sm text-slate-500 italic">No parts tracked</p>}
                        </div>
                        {partsStats.logisticsCount > 0 && (
                            <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded border border-blue-100 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                {partsStats.logisticsCount} upcoming logistics job{partsStats.logisticsCount !== 1 ? 's' : ''}
                            </div>
                        )}
                        <Button variant="link" className="p-0 h-auto text-blue-600 hover:underline text-sm block" onClick={() => onTabChange("parts")}>
                            View parts list
                        </Button>
                    </div>
                ) : (
                    <div className="text-sm text-slate-400">Loading parts...</div>
                )}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}