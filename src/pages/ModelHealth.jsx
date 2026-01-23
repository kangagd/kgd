import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, PlayCircle, ExternalLink, Server, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function ModelHealth() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin';

  // Core Locations Health
  const { data: coreLocations, isLoading: locationsLoading, refetch: refetchLocations } = useQuery({
    queryKey: ['coreLocations'],
    queryFn: async () => {
      const response = await base44.functions.invoke('auditCoreLocations', {});
      return response.data;
    },
    enabled: isAdmin,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Logistics Purpose Drift
  const { data: purposeDrift, isLoading: driftLoading, refetch: refetchDrift } = useQuery({
    queryKey: ['logisticsPurposeDrift'],
    queryFn: async () => {
      const response = await base44.functions.invoke('auditLogisticsPurposeDrift', {});
      return response.data;
    },
    enabled: isAdmin,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Automation Failures (last 14 days)
  const { data: automationFailures = [], isLoading: failuresLoading, refetch: refetchFailures } = useQuery({
    queryKey: ['automationFailures'],
    queryFn: async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const jobs = await base44.entities.Job.filter({
        status: 'Completed',
        updated_date: { $gte: fourteenDaysAgo.toISOString() }
      });

      return jobs.filter(job => 
        job.post_complete_error || job.post_complete_ran !== true
      ).sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
    },
    enabled: isAdmin,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Gmail Sync Health - Mock for now (can be implemented later)
  const { data: gmailHealth } = useQuery({
    queryKey: ['gmailHealth'],
    queryFn: async () => {
      // Placeholder - can implement proper sync tracking later
      return {
        lastSync: new Date().toISOString(),
        lastError: null,
        threads24h: 0,
        messages24h: 0
      };
    },
    enabled: isAdmin,
    staleTime: 60000,
  });

  // Re-run postComplete mutation
  const rerunMutation = useMutation({
    mutationFn: async (jobId) => {
      const response = await base44.functions.invoke('manageJob', {
        action: 'postComplete',
        id: jobId
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automationFailures'] });
      const summary = data?.summary || 'Post-completion automation re-run completed';
      toast.success(summary);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to re-run automation');
    }
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-[#111827] mb-2">Admin Access Required</h2>
            <p className="text-sm text-[#6B7280]">This page is only accessible to administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-bold text-[#111827] mb-1">System Health Dashboard</h1>
            <p className="text-[14px] text-[#6B7280]">
              Monitor core system health, logistics data integrity, and automation status
            </p>
          </div>
          <Button
            onClick={() => {
              refetchLocations();
              refetchDrift();
              refetchFailures();
            }}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh All
          </Button>
        </div>

        {/* 1) Core Locations Health */}
        <Card className="border-2 border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-[18px] font-semibold text-[#111827] flex items-center gap-2">
              <Server className="w-5 h-5 text-slate-600" />
              Core Locations Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {locationsLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                <span className="text-sm text-[#6B7280]">Checking core locations...</span>
              </div>
            ) : coreLocations ? (
              <div className="space-y-3">
                {coreLocations.ok ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-semibold">All core locations exist</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="text-sm font-semibold">Missing locations detected</span>
                    </div>
                    {coreLocations.missing && coreLocations.missing.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-red-700 mb-2">Missing:</div>
                        <div className="space-y-1">
                          {coreLocations.missing.map((loc, idx) => (
                            <div key={idx} className="text-sm text-red-600">• {loc}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#9CA3AF]">No data</p>
            )}
          </CardContent>
        </Card>

        {/* 2) Logistics Purpose Drift */}
        <Card className="border-2 border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-[18px] font-semibold text-[#111827] flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-slate-600" />
              Logistics Purpose Drift
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {driftLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                <span className="text-sm text-[#6B7280]">Analyzing logistics jobs...</span>
              </div>
            ) : purposeDrift ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className={`${purposeDrift.count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'} font-semibold text-[14px] px-3 py-1`}>
                    {purposeDrift.count || 0} issue{purposeDrift.count !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                {purposeDrift.jobs && purposeDrift.jobs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      First 25 Jobs
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {purposeDrift.jobs.slice(0, 25).map((job) => (
                        <div key={job.id} className="bg-white border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-[#111827]">#{job.job_number}</span>
                              <Badge className="bg-slate-100 text-slate-700 text-[11px]">{job.status}</Badge>
                            </div>
                            <div className="text-xs text-[#6B7280] space-y-0.5">
                              <div>Purpose: {job.logistics_purpose || 'not set'}</div>
                            </div>
                          </div>
                          <Link
                            to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
                            className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                            title="View Job"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#9CA3AF]">No data</p>
            )}
          </CardContent>
        </Card>

        {/* 3) Automation Failures (last 14 days) */}
        <Card className="border-2 border-red-200">
          <CardHeader className="bg-red-50 border-b border-red-200">
            <CardTitle className="text-[18px] font-semibold text-[#111827] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Automation Failures (Last 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {failuresLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                <span className="text-sm text-[#6B7280]">Loading failures...</span>
              </div>
            ) : automationFailures.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-sm text-green-700 font-medium">No automation failures in last 14 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Badge className="bg-red-600 text-white font-semibold text-[14px] px-3 py-1">
                  {automationFailures.length} failure{automationFailures.length !== 1 ? 's' : ''}
                </Badge>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {automationFailures.map((job) => (
                    <div key={job.id} className="bg-white border border-red-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[#111827]">#{job.job_number}</span>
                            {job.project_name && (
                              <span className="text-sm text-[#6B7280]">{job.project_name}</span>
                            )}
                          </div>
                          <div className="text-xs text-[#6B7280]">
                            Completed: {job.updated_date ? format(new Date(job.updated_date), 'MMM d, yyyy h:mm a') : 'N/A'}
                          </div>
                          {job.post_complete_error && (
                            <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                              <div className="text-xs text-red-700">{job.post_complete_error}</div>
                            </div>
                          )}
                          {!job.post_complete_error && job.post_complete_ran !== true && (
                            <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                              <div className="text-xs text-amber-700">Automation did not run</div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Link
                            to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
                            className="text-blue-600 hover:text-blue-700"
                            title="View Job"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rerunMutation.mutate(job.id)}
                            disabled={rerunMutation.isPending}
                            className="h-7 px-2 text-xs"
                            title="Re-run automation"
                          >
                            <PlayCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4) Gmail Sync Health */}
        <Card className="border-2 border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-[18px] font-semibold text-[#111827] flex items-center gap-2">
              <Mail className="w-5 h-5 text-slate-600" />
              Gmail Sync Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-1">Last Sync</div>
                <div className="font-semibold text-[#111827]">
                  {gmailHealth?.lastSync ? format(new Date(gmailHealth.lastSync), 'MMM d, yyyy h:mm a') : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-1">Last Error</div>
                <div className={`font-semibold ${gmailHealth?.lastError ? 'text-red-600' : 'text-green-600'}`}>
                  {gmailHealth?.lastError || 'None'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-1">Threads (24h)</div>
                <div className="font-semibold text-[#111827]">{gmailHealth?.threads24h || 0}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-1">Messages (24h)</div>
                <div className="font-semibold text-[#111827]">{gmailHealth?.messages24h || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}