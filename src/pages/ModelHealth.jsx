import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, PlayCircle, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isFeatureEnabled } from "@/components/domain/featureFlags";

export default function ModelHealth() {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState(null); // 'dry_run' | 'commit'
  const [user, setUser] = useState(null);

  const isModelHealthEnabled = isFeatureEnabled('model_health_fixes');

  // Load user
  useState(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin';

  // Fetch drift analysis
  const { data: driftData, isLoading, error, refetch } = useQuery({
    queryKey: ['modelDrift'],
    queryFn: async () => {
      const startTime = Date.now();
      const response = await base44.functions.invoke('analyzeModelDrift', {});
      const loadTime = Date.now() - startTime;
      return { ...response.data, loadTime };
    },
    enabled: isAdmin,
    staleTime: 60000, // 1 minute
  });

  // State for dry run results
  const [dryRunResults, setDryRunResults] = useState(null);

  // Dry run mutation - ALWAYS allowed (read-only)
  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('fixModelDrift', { dry_run: true });
      return response.data;
    },
    onSuccess: (data) => {
      setDryRunResults(data);
      toast.success(`Dry Run Complete: ${data.would_fix_count || 0} issues would be fixed (no changes made)`);
      queryClient.invalidateQueries({ queryKey: ['modelDrift'] });
    },
    onError: (error) => {
      const errorMsg = error?.response?.data?.error || error?.message || 'Dry run failed';
      toast.error(errorMsg);
    }
  });

  // Commit fix mutation - Requires feature flag
  const commitFixMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('fixModelDrift', { dry_run: false });
      return response.data;
    },
    onSuccess: (data) => {
      setDryRunResults(null);
      toast.success(`Fixed ${data.fixed_count} drift issues successfully`);
      queryClient.invalidateQueries({ queryKey: ['modelDrift'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (error) => {
      const errorMsg = error?.response?.data?.error || error?.message || 'Fix commit failed';
      toast.error(errorMsg);
    }
  });

  const handleAction = (action) => {
    // Dry run is always allowed (read-only)
    // Commit requires feature flag
    if (action === 'commit' && !isModelHealthEnabled) {
      toast.error('Model Health fixes are disabled. Enable FEATURE_MODEL_HEALTH_FIXES flag.');
      return;
    }
    setConfirmAction(action);
  };

  const confirmAndExecute = () => {
    if (confirmAction === 'dry_run') {
      dryRunMutation.mutate();
    } else if (confirmAction === 'commit') {
      commitFixMutation.mutate();
    }
    setConfirmAction(null);
  };

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
            <h1 className="text-[28px] font-bold text-[#111827] mb-1">Model Health Dashboard</h1>
            <p className="text-[14px] text-[#6B7280]">
              Detect and fix drift between legacy Job model and Visit model
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Feature Flag Status */}
        <Card className={`border-2 ${isModelHealthEnabled ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {isModelHealthEnabled ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">Model Health Fixes: ENABLED</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Model Health Fixes: DISABLED</span>
                  <span className="text-xs text-amber-700 ml-2">(Set FEATURE_MODEL_HEALTH_FIXES flag to enable)</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#FAE008] mx-auto mb-3" />
              <p className="text-sm text-[#6B7280]">Analyzing model drift...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Analysis Failed</h3>
              <p className="text-sm text-red-700">{error.message}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {driftData && !isLoading && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-[12px] text-[#6B7280] mb-1">Total Jobs Analyzed</div>
                  <div className="text-[28px] font-bold text-[#111827]">{driftData.total_jobs || 0}</div>
                  {driftData.loadTime && (
                    <div className="text-[11px] text-[#9CA3AF] mt-1">
                      Load time: {(driftData.loadTime / 1000).toFixed(2)}s
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-[12px] text-[#6B7280] mb-1">V2 Execution Jobs</div>
                  <div className="text-[28px] font-bold text-blue-600">{driftData.v2_execution_count || 0}</div>
                </CardContent>
              </Card>

              <Card className={driftData.fixable_drift_count > 0 ? 'border-2 border-amber-200' : 'border-2 border-green-200'}>
                <CardContent className="p-4">
                  <div className="text-[12px] text-[#6B7280] mb-1">Fixable Drift</div>
                  <div className={`text-[28px] font-bold ${driftData.fixable_drift_count > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {driftData.fixable_drift_count || 0}
                  </div>
                  {driftData.legacy_info_count > 0 && (
                    <div className="text-[11px] text-[#9CA3AF] mt-1">
                      +{driftData.legacy_info_count} v1 legacy (info only)
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-[12px] text-[#6B7280] mb-1">Health Score</div>
                  <div className={`text-[28px] font-bold ${driftData.health_score >= 95 ? 'text-green-600' : driftData.health_score >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                    {driftData.health_score || 0}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            {(driftData.fixable_drift_count > 0 || driftData.drift_issues_count > 0) && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-blue-900 mb-1">Dry Run Analysis</div>
                      <div className="text-xs text-blue-700 mb-3">
                        Read-only simulation • No writes • Always available
                      </div>
                      <Button
                        onClick={() => handleAction('dry_run')}
                        disabled={dryRunMutation.isPending}
                        variant="outline"
                        className="gap-2 w-full sm:w-auto"
                      >
                        {dryRunMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlayCircle className="w-4 h-4" />
                        )}
                        Run Dry Run
                      </Button>
                    </div>
                    
                    <div className="flex-1 sm:border-l border-blue-200 sm:pl-4">
                      <div className="text-sm font-semibold text-blue-900 mb-1">Commit Fixes</div>
                      <div className="text-xs text-blue-700 mb-3">
                        {isModelHealthEnabled 
                          ? `Writes data • ${driftData.fixable_drift_count || 0} fixable issues` 
                          : 'Blocked: Enable FEATURE_MODEL_HEALTH_FIXES'}
                      </div>
                      <Button
                        onClick={() => handleAction('commit')}
                        disabled={commitFixMutation.isPending || !isModelHealthEnabled || (driftData.fixable_drift_count === 0)}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto disabled:opacity-50"
                      >
                        {commitFixMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Commit Fixes
                      </Button>
                      {!isModelHealthEnabled && (
                        <div className="text-[10px] text-amber-700 mt-1">
                          Set FEATURE_MODEL_HEALTH_FIXES = true to enable
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Drift Issues by Type */}
            {driftData.issues_by_type && Object.keys(driftData.issues_by_type).length > 0 && (
              <div className="space-y-4">
                <h2 className="text-[22px] font-semibold text-[#111827]">Issues by Type</h2>
                
                {Object.entries(driftData.issues_by_type).map(([issueType, issueData]) => {
                  const severityConfig = {
                    error: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800', badgeBg: 'bg-red-600' },
                    warn: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', badgeBg: 'bg-amber-600' },
                    info: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-800', badgeBg: 'bg-blue-600' }
                  };
                  const config = severityConfig[issueData.severity] || severityConfig.error;
                  
                  return (
                    <Card key={issueType} className={`border-2 ${config.border}`}>
                      <CardHeader className={`${config.bg} border-b border-${issueData.severity === 'error' ? 'red' : issueData.severity === 'warn' ? 'amber' : 'blue'}-100`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className={`text-[18px] font-semibold ${config.text} flex items-center gap-2`}>
                            {issueData.severity === 'info' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            {issueType.replace(/_/g, ' ').toUpperCase()}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={`${config.badgeBg} text-white text-[14px] font-bold px-3 py-1`}>
                              {issueData.count}
                            </Badge>
                            {issueData.fixable === false && (
                              <Badge className="bg-slate-600 text-white text-[11px] px-2 py-0.5">
                                {issueData.severity === 'info' ? 'INFO ONLY' : 'NOT FIXABLE'}
                              </Badge>
                            )}
                            {issueData.fixable === true && (
                              <Badge className="bg-green-600 text-white text-[11px] px-2 py-0.5">
                                FIXABLE
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    <CardContent className="p-4">
                      <div className="mb-4 space-y-2">
                        {issueData.description && (
                          <p className="text-sm text-[#6B7280]">{issueData.description}</p>
                        )}
                        {issueData.fix_blocked_reason && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                            <strong>Fix blocked:</strong> {issueData.fix_blocked_reason.replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                      
                      {/* Sample Jobs */}
                      {issueData.sample_jobs && issueData.sample_jobs.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                            Sample Jobs (showing {Math.min(5, issueData.sample_jobs.length)} of {issueData.count})
                          </div>
                          <div className="space-y-2">
                            {issueData.sample_jobs.slice(0, 5).map((job) => (
                              <div key={job.id} className="bg-white border border-red-100 rounded-lg p-3 hover:border-red-300 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-[#111827]">#{job.job_number}</span>
                                      <span className="text-sm text-[#6B7280]">{job.customer_name}</span>
                                    </div>
                                    <div className="text-xs text-[#9CA3AF] space-y-0.5">
                                      <div>Visit Count: {job.visit_count || 0}</div>
                                      {job.actual_visits !== undefined && (
                                        <div>Actual Visits: {job.actual_visits}</div>
                                      )}
                                      <div>Model Version: {job.job_model_version || 'v1'}</div>
                                      <div>Status: {job.status}</div>
                                      {job.issue_details && (
                                        <div className={`font-medium mt-1 ${issueData.severity === 'info' ? 'text-blue-600' : 'text-red-600'}`}>
                                          {job.issue_details}
                                        </div>
                                      )}
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
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}

            {/* Dry Run Results */}
            {dryRunResults && (
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardHeader className="bg-purple-100 border-b border-purple-200">
                  <CardTitle className="text-[18px] font-semibold text-purple-800 flex items-center gap-2">
                    <PlayCircle className="w-5 h-5" />
                    Dry Run Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="text-sm text-purple-900 mb-3">
                    <strong>{dryRunResults.would_fix_count || 0}</strong> jobs would be fixed (no data was modified)
                  </div>
                  
                  {dryRunResults.would_fix_jobs && dryRunResults.would_fix_jobs.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                        Proposed Changes ({dryRunResults.would_fix_jobs.length} jobs)
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {dryRunResults.would_fix_jobs.map((fix, idx) => (
                          <div key={idx} className="bg-white border border-purple-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <div className="font-semibold text-[#111827]">#{fix.job_number}</div>
                                <div className="text-xs text-[#6B7280]">{fix.customer_name}</div>
                              </div>
                              <Link
                                to={`${createPageUrl("Jobs")}?jobId=${fix.job_id}`}
                                className="text-purple-600 hover:text-purple-700"
                                title="View Job"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </div>
                            <div className="bg-purple-50 px-2 py-1.5 rounded text-xs">
                              <div className="text-purple-900 font-medium mb-0.5">visit_count correction:</div>
                              <div className="text-purple-800">
                                {fix.old_visit_count} → {fix.new_visit_count} ({fix.visits_found} Visit records found)
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button
                    onClick={() => setDryRunResults(null)}
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-purple-700 hover:text-purple-800"
                  >
                    Clear Results
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* No Issues Found */}
            {driftData.drift_issues_count === 0 && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="p-12 text-center">
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-800 mb-2">All Systems Healthy</h3>
                  <p className="text-sm text-green-700">No drift issues detected between Job and Visit models.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-semibold text-[#111827]">
              {confirmAction === 'dry_run' ? 'Run Dry Run Analysis?' : 'Commit Fixes to Database?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-slate-600 space-y-2">
              {confirmAction === 'dry_run' ? (
                <>
                  <p>This will analyze what would be fixed <strong>without making any changes</strong> to the database.</p>
                  <p className="text-green-700 font-medium">✓ Read-only operation - Safe to run anytime</p>
                  <p className="text-green-700 font-medium">✓ No writes to Job, Visit, or any entity</p>
                  <p className="text-green-700 font-medium">✓ Works even when FEATURE_MODEL_HEALTH_FIXES is disabled</p>
                </>
              ) : (
                <>
                  <p>This will <strong>permanently modify</strong> up to {driftData?.fixable_drift_count || 0} job(s).</p>
                  <p className="text-blue-700 font-medium">• Only applies safe fixes (visit_count sync, version markers)</p>
                  <p className="text-red-700 font-medium">⚠ Database writes will occur</p>
                  <p className="text-amber-700 font-medium">⚠ Review dry run results first</p>
                  <p className="text-amber-700 font-medium">⚠ Requires FEATURE_MODEL_HEALTH_FIXES enabled</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndExecute}
              className={`rounded-xl font-semibold ${
                confirmAction === 'commit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]'
              }`}
            >
              {confirmAction === 'dry_run' ? 'Run Dry Run' : 'Commit Changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}