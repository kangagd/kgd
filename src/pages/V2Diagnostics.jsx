import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function V2Diagnostics() {
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setAllowed(currentUser?.role === 'admin');
      } catch (error) {
        console.error('Error loading user:', error);
        setAllowed(false);
      }
    };
    loadUser();
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Access Denied</CardTitle>
            <CardDescription className="text-red-800">
              Admin access required for V2 Diagnostics.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const runDiagnostic = async (fnName, params) => {
    setLoading(prev => ({ ...prev, [fnName]: true }));
    try {
      const result = await base44.functions.invoke(fnName, params);
      
      if (result.data?.success) {
        setResults(prev => ({ ...prev, [fnName]: result.data }));
        toast.success(`${fnName}: ${result.data.summary || 'Success'}`);
      } else {
        toast.error(`${fnName} failed: ${result.data?.error || 'unknown error'}`);
        setResults(prev => ({ ...prev, [fnName]: { error: result.data?.error } }));
      }
    } catch (error) {
      console.error(`${fnName} error:`, error);
      toast.error(`${fnName} error: ${error.message}`);
      setResults(prev => ({ ...prev, [fnName]: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [fnName]: false }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Parts/Logistics V2 Diagnostics</h1>
        <p className="text-gray-600">Admin tools for fixing data issues and recomputing cached fields.</p>
      </div>

      {/* Project Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="project-id">Project ID (for project-scoped operations)</Label>
              <Input
                id="project-id"
                placeholder="Paste project ID here"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      <div className="grid gap-6">
        {/* Readiness */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Recompute Readiness
              <Badge variant="outline">Project-scoped</Badge>
            </CardTitle>
            <CardDescription>Recalculate visit readiness based on allocations and consumptions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('computeVisitReadiness', { project_id: projectId })}
              disabled={loading['computeVisitReadiness'] || !projectId}
              className="w-full"
            >
              {loading['computeVisitReadiness'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Recompute Readiness'
              )}
            </Button>
            {results['computeVisitReadiness'] && (
              <ResultsDisplay result={results['computeVisitReadiness']} />
            )}
          </CardContent>
        </Card>

        {/* Requirement Fulfillment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Recompute Requirement Fulfillment
              <Badge variant="outline">Project-scoped</Badge>
            </CardTitle>
            <CardDescription>Recalculate whether all blocking requirements are met.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('computeProjectRequirementFulfillment', { project_id: projectId })}
              disabled={loading['computeProjectRequirementFulfillment'] || !projectId}
              className="w-full"
            >
              {loading['computeProjectRequirementFulfillment'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Recompute Requirements'
              )}
            </Button>
            {results['computeProjectRequirementFulfillment'] && (
              <ResultsDisplay result={results['computeProjectRequirementFulfillment']} />
            )}
          </CardContent>
        </Card>

        {/* Normalize SLA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Normalize Receipt SLA
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Ensure all receipts have sla_clock_start_at and sla_due_at fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('normalizeReceiptSlaFromReceivedAt', {})}
              disabled={loading['normalizeReceiptSlaFromReceivedAt']}
              className="w-full"
            >
              {loading['normalizeReceiptSlaFromReceivedAt'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Normalize SLA'
              )}
            </Button>
            {results['normalizeReceiptSlaFromReceivedAt'] && (
              <ResultsDisplay result={results['normalizeReceiptSlaFromReceivedAt']} />
            )}
          </CardContent>
        </Card>

        {/* Backfill Cached Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Backfill Cached Display Fields
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Populate names/numbers for Projects, Jobs, Vehicles, Locations in related records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('backfillCachedDisplayFields', {})}
              disabled={loading['backfillCachedDisplayFields']}
              className="w-full"
            >
              {loading['backfillCachedDisplayFields'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Backfill Fields'
              )}
            </Button>
            {results['backfillCachedDisplayFields'] && (
              <ResultsDisplay result={results['backfillCachedDisplayFields']} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultsDisplay({ result }) {
  if (result.error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-800">
          <p className="font-semibold">Error</p>
          <p>{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
      <div className="flex gap-2 items-start">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-800">
          <p className="font-semibold">Success</p>
          {result.summary && <p>{result.summary}</p>}
        </div>
      </div>
      
      {/* Display structured results */}
      {Object.entries(result).map(([key, value]) => {
        if (key === 'success' || key === 'summary' || key === 'error') return null;
        if (typeof value === 'object') {
          return (
            <div key={key} className="text-xs text-green-700 mt-2 pl-7">
              <p className="font-mono bg-green-100 rounded px-2 py-1">
                {key}: {JSON.stringify(value)}
              </p>
            </div>
          );
        }
        return (
          <div key={key} className="text-xs text-green-700 mt-1 pl-7">
            {key}: {String(value)}
          </div>
        );
      })}
    </div>
  );
}