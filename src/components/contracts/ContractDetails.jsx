import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, MapPin, Calendar, Clock, AlertTriangle, CheckCircle2, Building2, Sparkles, RefreshCw, Shield, Activity, Lightbulb, Timer } from "lucide-react";
import SLAPerformanceTab from "./SLAPerformanceTab";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, isPast } from "date-fns";
import JobList from "../jobs/JobList";
import JobCard from "../jobs/JobCard";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function ContractDetails({ contract, onClose, onEdit }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const queryClient = useQueryClient();
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['contractDashboard', contract.id],
    queryFn: async () => {
      const response = await base44.functions.invoke('getContractDashboardData', { contract_id: contract.id });
      return response.data;
    }
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['contractJobs', contract.id],
    queryFn: () => base44.entities.Job.filter({ contract_id: contract.id })
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['contractProjects', contract.id],
    queryFn: () => base44.entities.Project.filter({ contract_id: contract.id })
  });

  const stations = dashboardData?.stations || [];
  const slaBreaches = dashboardData?.sla_breaches || [];
  const recentCompleted = dashboardData?.recent_completed || [];
  const upcomingMaintenance = dashboardData?.upcoming_maintenance || [];

  const generateInsightsMutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiContractInsights', { contract_id: contract.id }),
    onSuccess: (response) => {
        if (response.data?.success) {
            toast.success("AI Insights generated successfully");
            // Invalidate to fetch updated contract with new insights
            // Ideally we should refetch the contract data passed as prop or have useQuery for it inside component if not present
            // Since contract is passed as prop, we might need to reload page or parent needs to refetch.
            // For now, let's just reload window or assume parent handles it.
            // But wait, we need to see the changes.
            // Assuming parent passes updated contract on prop change if using react-query there.
             queryClient.invalidateQueries(['contracts']);
             queryClient.invalidateQueries(['contract', contract.id]);
             if (onClose) {
                 // Hacky way to force refresh if we can't control parent query
                 // window.location.reload();
                 // Better: Let user refresh manually or trust react-query if configured right
             }
        } else {
            toast.error("Failed to generate insights");
        }
    },
    onError: () => toast.error("Error generating insights")
  });

  const handleGenerateInsights = () => {
      setIsGeneratingInsights(true);
      generateInsightsMutation.mutate(undefined, {
          onSettled: () => setIsGeneratingInsights(false)
      });
  };

  // Parse AI insights if string, or use object
  const aiInsights = typeof contract.ai_insights === 'string' 
    ? JSON.parse(contract.ai_insights || '{}') 
    : (contract.ai_insights || {});

  return (
    <div className="p-4 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#111827]">{contract.name}</h1>
            <Badge className={
              contract.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }>
              {contract.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600 items-center">
             {contract.organisation_name && (
               <span className="flex items-center gap-1 font-medium text-gray-900">
                 <Building2 className="w-4 h-4 text-gray-500" />
                 {contract.organisation_name}
               </span>
             )}
            <span>Type: {contract.contract_type}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{format(parseISO(contract.start_date), 'MMM d, yyyy')}</span>
                {contract.end_date ? (
                    <>
                        <span>-</span>
                        <span>{format(parseISO(contract.end_date), 'MMM d, yyyy')}</span>
                    </>
                ) : (
                    <span className="italic ml-1">(Ongoing)</span>
                )}
            </div>
          </div>
        </div>
        <Button onClick={onEdit} variant="outline" className="border-2">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Overview</TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="stations">Stations ({stations.length})</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="sla" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
             <Timer className="w-4 h-4 mr-2 text-red-500" />
             SLA Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-6">
             <div className="flex justify-between items-center">
                 <div>
                    <h2 className="text-xl font-bold text-indigo-900">AI Contract Analysis</h2>
                    <p className="text-sm text-gray-500">
                        {contract.insights_generated_at 
                            ? `Generated on ${format(parseISO(contract.insights_generated_at), 'MMM d, yyyy h:mm a')}`
                            : 'No insights generated yet'}
                    </p>
                 </div>
                 <Button 
                    onClick={handleGenerateInsights} 
                    disabled={isGeneratingInsights}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                 >
                     <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                     {isGeneratingInsights ? 'Analyzing...' : 'Refresh Analysis'}
                 </Button>
             </div>

             {(!contract.ai_insights) ? (
                 <Card className="bg-slate-50 border-dashed border-2 border-slate-300">
                     <CardContent className="py-12 text-center">
                         <Sparkles className="w-12 h-12 mx-auto text-indigo-300 mb-4" />
                         <h3 className="text-lg font-medium text-gray-900">No AI Insights Yet</h3>
                         <p className="text-gray-500 mb-6 max-w-md mx-auto">
                             Generate an AI analysis to identify high-risk stations, recurring issues, and actionable recommendations.
                         </p>
                         <Button onClick={handleGenerateInsights} className="bg-indigo-600 hover:bg-indigo-700">
                             Generate First Report
                         </Button>
                     </CardContent>
                 </Card>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Executive Summary */}
                     <Card className="md:col-span-2 border-indigo-100 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
                         <CardHeader>
                             <CardTitle className="flex items-center gap-2 text-indigo-900">
                                 <Activity className="w-5 h-5 text-indigo-600" />
                                 Executive Summary
                             </CardTitle>
                         </CardHeader>
                         <CardContent>
                             <p className="text-gray-700 leading-relaxed text-lg">
                                 {aiInsights.summary || "No summary available."}
                             </p>
                         </CardContent>
                     </Card>

                     {/* High Risk Stations */}
                     <Card className="border-red-100 shadow-sm">
                         <CardHeader>
                             <CardTitle className="flex items-center gap-2 text-red-900">
                                 <Shield className="w-5 h-5 text-red-600" />
                                 High-Risk Stations
                             </CardTitle>
                         </CardHeader>
                         <CardContent>
                             <ul className="space-y-3">
                                 {aiInsights.high_risk_stations?.map((station, idx) => (
                                     <li key={idx} className="flex items-start gap-2 text-gray-700">
                                         <span className="bg-red-100 text-red-700 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{idx + 1}</span>
                                         {station}
                                     </li>
                                 ))}
                                 {(!aiInsights.high_risk_stations?.length) && (
                                     <p className="text-gray-500 italic">No high-risk stations identified.</p>
                                 )}
                             </ul>
                         </CardContent>
                     </Card>

                     {/* Common Issues */}
                     <Card className="border-orange-100 shadow-sm">
                         <CardHeader>
                             <CardTitle className="flex items-center gap-2 text-orange-900">
                                 <AlertTriangle className="w-5 h-5 text-orange-600" />
                                 Recurring Issues
                             </CardTitle>
                         </CardHeader>
                         <CardContent>
                             <ul className="space-y-3">
                                 {aiInsights.common_issues?.map((issue, idx) => (
                                     <li key={idx} className="flex items-start gap-2 text-gray-700">
                                         <span className="bg-orange-100 text-orange-700 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                                         {issue}
                                     </li>
                                 ))}
                                 {(!aiInsights.common_issues?.length) && (
                                     <p className="text-gray-500 italic">No recurring issues identified.</p>
                                 )}
                             </ul>
                         </CardContent>
                     </Card>

                     {/* Recommended Actions */}
                     <Card className="md:col-span-2 border-green-100 shadow-sm">
                         <CardHeader>
                             <CardTitle className="flex items-center gap-2 text-green-900">
                                 <Lightbulb className="w-5 h-5 text-green-600" />
                                 Recommended Actions
                             </CardTitle>
                         </CardHeader>
                         <CardContent>
                             <div className="grid md:grid-cols-2 gap-4">
                                 {aiInsights.recommended_actions?.map((action, idx) => (
                                     <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                                         <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                         <span className="text-green-900 font-medium">{action}</span>
                                     </div>
                                 ))}
                             </div>
                              {(!aiInsights.recommended_actions?.length) && (
                                 <p className="text-gray-500 italic">No recommendations available.</p>
                             )}
                         </CardContent>
                     </Card>
                 </div>
             )}
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <Card className="border-2 border-slate-200">
             <CardHeader>
               <CardTitle className="text-lg">Contract Details</CardTitle>
             </CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <h4 className="text-sm font-medium text-gray-500 mb-1">SLA Response Time</h4>
                   <p className="text-lg font-semibold text-gray-900">{contract.sla_response_time_hours ? `${contract.sla_response_time_hours} Hours` : 'N/A'}</p>
                </div>
                <div>
                   <h4 className="text-sm font-medium text-gray-500 mb-1">Billing Model</h4>
                   <p className="text-lg font-semibold text-gray-900">{contract.billing_model || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                   <h4 className="text-sm font-medium text-gray-500 mb-1">Service Coverage</h4>
                   <p className="text-gray-900">{contract.service_coverage || 'No coverage details provided.'}</p>
                </div>
                {contract.notes && (
                  <div className="md:col-span-2">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Notes</h4>
                    <p className="text-gray-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border">{contract.notes}</p>
                  </div>
                )}
             </CardContent>
          </Card>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-blue-600 mb-1">Open Jobs</div>
                <div className="text-3xl font-bold text-blue-900">{dashboardData?.open_jobs_count || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-red-600 mb-1">SLA Breaches</div>
                <div className="text-3xl font-bold text-red-900">{dashboardData?.sla_breaches_count || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-green-600 mb-1">Active Stations</div>
                <div className="text-3xl font-bold text-green-900">{stations.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-purple-600 mb-1">SLA Target</div>
                <div className="text-3xl font-bold text-purple-900">{contract.sla_response_time_hours || '-'}h</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* SLA Breaches List */}
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  SLA Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                {slaBreaches.length === 0 ? (
                  <p className="text-gray-500 text-sm">No current SLA breaches.</p>
                ) : (
                  <div className="space-y-3">
                    {slaBreaches.map(job => (
                      <div key={job.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                        <div>
                          <div className="font-semibold text-red-900">Job #{job.job_number}</div>
                          <div className="text-sm text-red-700">{job.customer_name}</div>
                        </div>
                        <div className="text-right text-sm text-red-800">
                          Due: {format(parseISO(job.sla_due_at), 'MMM d HH:mm')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Maintenance */}
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Upcoming Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingMaintenance.length === 0 ? (
                  <p className="text-gray-500 text-sm">No upcoming maintenance scheduled.</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingMaintenance.map(job => (
                      <div key={job.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="font-semibold text-blue-900">Job #{job.job_number}</div>
                        <div className="text-sm text-blue-800">
                          {format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Work */}
          <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Recent Completed Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCompleted.length === 0 ? (
              <p className="text-gray-500 text-sm">No recently completed jobs.</p>
            ) : (
              <div className="grid gap-4">
                {recentCompleted.map(simpleJob => {
                  const fullJob = jobs.find(j => j.id === simpleJob.id) || simpleJob;
                  return (
                    <JobCard 
                      key={fullJob.id} 
                      job={fullJob} 
                      onClick={() => window.location.href = createPageUrl('Jobs') + `?jobId=${fullJob.id}`}
                      onViewDetails={() => window.location.href = createPageUrl('Jobs') + `?jobId=${fullJob.id}`}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stations">
          <div className="grid gap-4">
            {stations.map(station => (
              <Card key={station.id} className="border border-slate-200">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg">{station.name}</div>
                    {/* Fetch address/details if needed, currently dashboardData returns partial station info usually */}
                  </div>
                  <Link to={createPageUrl('Customers') + `?customerId=${station.id}`}>
                    <Button variant="outline" size="sm">View Station</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
            {stations.length === 0 && <p className="text-gray-500">No stations linked.</p>}
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <JobList 
            jobs={jobs} 
            isLoading={false}
            onSelectJob={() => {}}
            onViewDetails={(job) => window.location.href = createPageUrl('Jobs') + `?jobId=${job.id}`}
          />
        </TabsContent>
        
        <TabsContent value="projects">
            {projects.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No projects linked to this contract</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {projects.map(project => (
                         <div 
                            key={project.id} 
                            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-[#FAE008] hover:shadow-md transition-all cursor-pointer"
                            onClick={() => window.location.href = createPageUrl('Projects') + `?projectId=${project.id}`}
                         >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-lg text-gray-900">{project.title}</h3>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {project.project_type} • {project.status}
                                    </div>
                                </div>
                                <Badge variant="outline">{project.status}</Badge>
                            </div>
                         </div>
                    ))}
                </div>
            )}
        </TabsContent>

        <TabsContent value="sla">
            <SLAPerformanceTab contract={contract} jobs={jobs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}