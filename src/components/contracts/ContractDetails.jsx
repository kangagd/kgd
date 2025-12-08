import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, MapPin, Calendar, Clock, AlertTriangle, CheckCircle2, Building2 } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import JobList from "../jobs/JobList";
import JobCard from "../jobs/JobCard";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import BackButton from "../common/BackButton";

export default function ContractDetails({ contract, onClose, onEdit }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['contractDashboard', contract.id],
    queryFn: async () => {
      const response = await base44.functions.invoke('getContractDashboardData', { contract_id: contract.id });
      return response.data;
    }
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['contractJobs', contract.id],
    queryFn: async () => {
      // Get jobs directly linked to contract
      const directJobs = await base44.entities.Job.filter({ contract_id: contract.id });
      
      // Get all stations (customers) linked to this contract
      const stations = await base44.entities.Customer.filter({ contract_id: contract.id, is_station: true });
      const stationIds = stations.map(s => s.id);
      
      // Get jobs for those stations
      const stationJobs = stationIds.length > 0
        ? await Promise.all(stationIds.map(id => base44.entities.Job.filter({ customer_id: id })))
        : [];
      const flatStationJobs = stationJobs.flat();
      
      // Combine and deduplicate
      const allJobs = [...directJobs, ...flatStationJobs];
      const uniqueJobs = allJobs.reduce((acc, job) => {
        if (!acc.find(j => j.id === job.id)) {
          acc.push(job);
        }
        return acc;
      }, []);
      
      return uniqueJobs.filter(job => !job.deleted_at);
    }
  });

  const stations = dashboardData?.stations || [];
  const slaBreaches = dashboardData?.sla_breaches || [];
  const recentCompleted = dashboardData?.recent_completed || [];
  const upcomingMaintenance = dashboardData?.upcoming_maintenance || [];

  return (
    <div className="p-4 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <BackButton onClick={onClose} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#111827]">{contract.name}</h1>
            <Badge className={
              contract.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }>
              {contract.status}
            </Badge>
          </div>
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
            <span>Type: {contract.contract_type}</span>
            <span>•</span>
            <span>Start: {contract.start_date}</span>
            {contract.end_date && (
              <>
                <span>•</span>
                <span>End: {contract.end_date}</span>
              </>
            )}
          </div>
        </div>
        <Button onClick={onEdit} variant="outline" className="border-2">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="stations">Stations ({stations.length})</TabsTrigger>
          <TabsTrigger value="jobs">All Jobs ({jobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
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
      </Tabs>
    </div>
  );
}