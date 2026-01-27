import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function BackfillJobTypeAdmin() {
  const [dryRunResults, setDryRunResults] = useState(null);
  const [isLoadingDryRun, setIsLoadingDryRun] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleDryRun = async () => {
    setIsLoadingDryRun(true);
    try {
      const response = await base44.functions.invoke('backfillJobType', {
        dryRun: true,
        limit: 200
      });
      setDryRunResults(response.data);
      toast.success(`Dry-run complete: ${response.data.stats.total_proposed} jobs proposed`);
    } catch (error) {
      toast.error(error.message || "Dry-run failed");
    } finally {
      setIsLoadingDryRun(false);
    }
  };

  const handleApply = async () => {
    if (!dryRunResults) return;
    
    setIsApplying(true);
    try {
      const response = await base44.functions.invoke('backfillJobType', {
        dryRun: false,
        limit: 200,
        apply_low_confidence: false
      });
      toast.success(`Applied ${response.data.applied_count} job type assignments`);
      setDryRunResults(null);
    } catch (error) {
      toast.error(error.message || "Apply failed");
    } finally {
      setIsApplying(false);
    }
  };

  const getConfidenceBadgeColor = (confidence) => {
    switch (confidence) {
      case 'HIGH': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#111827] mb-2">Backfill Job Type</h1>
        <p className="text-[#6B7280]">Infer and assign JobType to jobs missing job_type_id using deterministic rules</p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Review Changes</CardTitle>
          <CardDescription>Run a dry-run to see what would be changed, then apply if satisfied</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handleDryRun}
              disabled={isLoadingDryRun || isApplying}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            >
              {isLoadingDryRun ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Dry-Run...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Dry-Run
                </>
              )}
            </Button>

            {dryRunResults && (
              <Button
                onClick={handleApply}
                disabled={isApplying}
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Apply Changes
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {dryRunResults && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-[#6B7280]">Jobs Checked</p>
                  <p className="text-2xl font-bold text-[#111827]">{dryRunResults.found}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-[#6B7280]">Proposed</p>
                  <p className="text-2xl font-bold text-[#111827]">{dryRunResults.stats.total_proposed}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-[#6B7280]">Skipped</p>
                  <p className="text-2xl font-bold text-[#111827]">{dryRunResults.stats.skipped_count}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-[#6B7280]">High Confidence</p>
                  <p className="text-2xl font-bold text-[#111827]">{dryRunResults.stats.high_confidence}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <p className="text-sm text-[#6B7280]">HIGH Confidence</p>
                  <p className="font-semibold text-green-700">{dryRunResults.stats.high_confidence}</p>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4 py-2">
                  <p className="text-sm text-[#6B7280]">MEDIUM Confidence</p>
                  <p className="font-semibold text-yellow-700">{dryRunResults.stats.medium_confidence}</p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4 py-2">
                  <p className="text-sm text-[#6B7280]">LOW Confidence</p>
                  <p className="font-semibold text-orange-700">{dryRunResults.stats.low_confidence}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proposed Changes */}
          <Card>
            <CardHeader>
              <CardTitle>Proposed Changes ({dryRunResults.proposed.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {dryRunResults.proposed.map((prop, idx) => (
                  <div key={idx} className="border border-[#E5E7EB] rounded-lg p-4 hover:bg-[#F9FAFB] transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-[#111827]">Job #{prop.job_number}</p>
                        <p className="text-sm text-[#6B7280]">{prop.job_id}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getConfidenceBadgeColor(prop.confidence)}>
                          {prop.confidence}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-[#6B7280]">Proposed Type</p>
                        <p className="font-medium text-[#111827]">{prop.proposed_job_type_name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#6B7280]">Reasons</p>
                        <ul className="text-sm text-[#4B5563] space-y-1">
                          {prop.reasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-[#9CA3AF] mt-0.5">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {prop.evidence && (
                        <div className="text-xs text-[#6B7280] bg-[#F3F4F6] p-2 rounded">
                          <p className="font-medium mb-1">Evidence:</p>
                          {prop.evidence.job_title && <p>Title: "{prop.evidence.job_title}"</p>}
                          {prop.evidence.job_snippet && <p>Notes: "{prop.evidence.job_snippet}"</p>}
                          {prop.evidence.last_email_subject && <p>Email: "{prop.evidence.last_email_subject}"</p>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Skipped Jobs */}
          {dryRunResults.skipped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Skipped ({dryRunResults.skipped.length})</CardTitle>
                <CardDescription>Jobs that could not be matched to any JobType</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {dryRunResults.skipped.map((skip, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#F3F4F6] rounded-lg">
                      <p className="text-sm text-[#4B5563]">{skip.job_id}</p>
                      <Badge variant="outline" className="text-xs">{skip.reason}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning */}
          {dryRunResults.stats.low_confidence > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                {dryRunResults.stats.low_confidence} LOW-confidence matches will NOT be applied. Only HIGH and MEDIUM confidence matches will be applied.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}