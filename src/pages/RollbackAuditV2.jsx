import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const StatusChip = ({ status }) => {
  const config = {
    OK: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2, label: 'OK' },
    WARNING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle, label: 'WARNING' },
    CRITICAL: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle, label: 'CRITICAL' }
  };
  const cfg = config[status] || config.OK;
  const Icon = cfg.icon;
  return (
    <div className={`${cfg.bg} ${cfg.text} px-4 py-2 rounded-lg flex items-center gap-2 font-semibold`}>
      <Icon className="w-5 h-5" />
      {cfg.label}
    </div>
  );
};

const ModuleCard = ({ moduleName, result }) => {
  const [expanded, setExpanded] = useState(false);

  if (result.error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            {moduleName}
            <Badge className="bg-red-200 text-red-800">Error</Badge>
          </CardTitle>
          <CardDescription className="text-red-700">{result.error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const criticalIssues = result.issues?.filter(i => i.severity === 'critical') || [];
  const warningIssues = result.issues?.filter(i => i.severity === 'warning') || [];
  const totalIssues = (result.issues || []).length;

  const statusColor = criticalIssues.length > 0 ? 'bg-red-100 text-red-800' : warningIssues.length > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

  return (
    <Card className="border-l-4" style={{ borderLeftColor: criticalIssues.length > 0 ? '#dc2626' : warningIssues.length > 0 ? '#eab308' : '#22c55e' }}>
      <CardHeader 
        className="pb-3 cursor-pointer hover:bg-slate-50" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {moduleName}
          </CardTitle>
          <Badge className={statusColor}>
            {totalIssues > 0 ? `${totalIssues} issue${totalIssues !== 1 ? 's' : ''}` : 'OK'}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-1">{result.summary}</CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 border-t pt-4">
          {criticalIssues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-red-700">Critical Issues</h4>
              {criticalIssues.map((issue, idx) => (
                <div key={idx} className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs font-medium text-red-900">{issue.check}</p>
                  <p className="text-xs text-red-800 mt-1">{issue.message}</p>
                  {issue.evidence && (
                    <details className="text-xs text-red-700 mt-1">
                      <summary className="cursor-pointer font-mono">Evidence</summary>
                      <pre className="bg-white text-xs p-1 mt-1 overflow-auto max-h-24 rounded border border-red-100">
                        {JSON.stringify(issue.evidence, null, 2)}
                      </pre>
                    </details>
                  )}
                  {issue.recommended_fix && (
                    <p className="text-xs bg-yellow-50 text-yellow-800 p-1 mt-2 rounded border-l-2 border-yellow-400">
                      <strong>Fix:</strong> {issue.recommended_fix}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {warningIssues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-yellow-700">Warnings</h4>
              {warningIssues.map((issue, idx) => (
                <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <p className="text-xs font-medium text-yellow-900">{issue.check}</p>
                  <p className="text-xs text-yellow-800 mt-1">{issue.message}</p>
                  {issue.evidence && (
                    <details className="text-xs text-yellow-700 mt-1">
                      <summary className="cursor-pointer font-mono">Evidence</summary>
                      <pre className="bg-white text-xs p-1 mt-1 overflow-auto max-h-24 rounded border border-yellow-100">
                        {JSON.stringify(issue.evidence, null, 2)}
                      </pre>
                    </details>
                  )}
                  {issue.recommended_fix && (
                    <p className="text-xs bg-blue-50 text-blue-800 p-1 mt-2 rounded border-l-2 border-blue-400">
                      <strong>Fix:</strong> {issue.recommended_fix}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalIssues === 0 && (
            <p className="text-xs text-green-700 italic">No issues detected</p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default function RollbackAuditV2() {
  const [auditResult, setAuditResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Fetch DATA_INTEGRITY_MODE status
  const { data: appSettings } = useQuery({
    queryKey: ['app-settings', 'DATA_INTEGRITY_MODE'],
    queryFn: async () => {
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'DATA_INTEGRITY_MODE' });
        return settings.length > 0 ? settings[0] : null;
      } catch (e) {
        console.error('Error fetching DATA_INTEGRITY_MODE:', e);
        return null;
      }
    },
    staleTime: 30000
  });

  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      const response = await base44.functions.invoke('appRollbackAuditV2', {});
      setAuditResult(response.data);
      queryClient.invalidateQueries({ queryKey: ['rollback-audit'] });
      toast.success('Audit complete');
    } catch (error) {
      console.error('Audit error:', error);
      toast.error(error.message || 'Audit failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rollback Audit (V2)</h1>
          <p className="text-gray-600 text-sm mt-1">
            Comprehensive app integrity scan to detect regressions and deployment issues
          </p>
        </div>
        {appSettings && (
          <Badge className={appSettings.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            Data Integrity Mode: {appSettings.value ? 'ON' : 'OFF'}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleRunAudit}
          disabled={isRunning}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Run Audit
            </>
          )}
        </Button>
        {auditResult && (
          <p className="text-xs text-gray-500">
            Last run: {new Date(auditResult.run_at).toLocaleString()}
          </p>
        )}
      </div>

      {auditResult && (
        <div className="space-y-6">
          {/* Overall Status */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Overall Status</span>
                <StatusChip status={auditResult.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-red-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-red-700">{auditResult.summary.critical}</p>
                  <p className="text-xs text-red-600">Critical Issues</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-yellow-700">{auditResult.summary.warnings}</p>
                  <p className="text-xs text-yellow-600">Warnings</p>
                </div>
                <div className="bg-green-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-green-700">{Object.keys(auditResult.modules).length}</p>
                  <p className="text-xs text-green-600">Modules Checked</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-Module Cards */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Module Results</h2>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(auditResult.modules).map(([moduleName, result]) => (
                <ModuleCard 
                  key={moduleName}
                  moduleName={moduleName.replace('_', ' ').toUpperCase()}
                  result={result}
                />
              ))}
            </div>
          </div>

          {/* Critical Issues Summary */}
          {auditResult.critical.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <AlertCircle className="w-5 h-5" />
                  Critical Issues Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {auditResult.critical.map((issue, idx) => (
                    <li key={idx} className="text-sm text-red-800 flex gap-2">
                      <span className="font-mono text-xs bg-red-100 px-2 py-1 rounded">
                        {issue.module}:{issue.check}
                      </span>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}