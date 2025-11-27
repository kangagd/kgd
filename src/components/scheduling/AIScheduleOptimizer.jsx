import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  User, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Target,
  Users
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function AIScheduleOptimizer({ 
  projectId, 
  jobId, 
  onApplySchedule,
  onApplyTechnician,
  compact = false 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [optimization, setOptimization] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const handleOptimize = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('aiScheduleOptimizer', {
        project_id: projectId,
        job_id: jobId
      });

      if (response.data?.success) {
        setOptimization(response.data.optimization);
        setExpanded(true);
        toast.success('AI scheduling analysis complete');
      } else {
        toast.error(response.data?.error || 'Failed to analyze schedule');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      toast.error('Failed to run AI optimization');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      return format(parseISO(dateStr), 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      high: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-red-100 text-red-700'
    };
    return colors[confidence] || colors.medium;
  };

  if (compact && !optimization) {
    return (
      <Button
        onClick={handleOptimize}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        AI Schedule
      </Button>
    );
  }

  return (
    <Card className="border border-purple-200 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <CardTitle className="text-[16px] font-semibold text-purple-900">
              AI Schedule Optimizer
            </CardTitle>
          </div>
          {optimization && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-purple-600"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!optimization ? (
          <div className="text-center py-4">
            <p className="text-[13px] text-purple-700 mb-3">
              Let AI analyze project scope, technician availability, and dependencies to suggest optimal scheduling.
            </p>
            <Button
              onClick={handleOptimize}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Optimize Schedule
                </>
              )}
            </Button>
          </div>
        ) : expanded && (
          <div className="space-y-4">
            {/* Recommended Schedule */}
            {optimization.suggested_schedule && (
              <div className="bg-white rounded-lg border border-purple-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-purple-600" />
                  <h4 className="text-[14px] font-semibold text-[#111827]">Recommended Schedule</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-[14px] font-medium">
                      {formatDate(optimization.suggested_schedule.recommended_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-[14px] font-medium">
                      {optimization.suggested_schedule.recommended_time || 'Flexible'}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] text-[#4B5563] mb-3">
                  {optimization.suggested_schedule.reasoning}
                </p>
                {onApplySchedule && (
                  <Button
                    onClick={() => onApplySchedule({
                      date: optimization.suggested_schedule.recommended_date,
                      time: optimization.suggested_schedule.recommended_time,
                      technicians: optimization.suggested_schedule.recommended_technicians
                    })}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Apply Schedule
                  </Button>
                )}
              </div>
            )}

            {/* Estimated Duration */}
            {optimization.estimated_duration && (
              <div className="bg-white rounded-lg border border-purple-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <h4 className="text-[14px] font-semibold text-[#111827]">Estimated Duration</h4>
                  </div>
                  <Badge className={getConfidenceBadge(optimization.estimated_duration.confidence)}>
                    {optimization.estimated_duration.confidence} confidence
                  </Badge>
                </div>
                <div className="text-[24px] font-bold text-purple-600 mb-2">
                  {optimization.estimated_duration.hours} hours
                </div>
                {optimization.estimated_duration.factors?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {optimization.estimated_duration.factors.map((factor, idx) => (
                      <Badge key={idx} variant="outline" className="text-[11px] bg-purple-50">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Technician Recommendations */}
            {optimization.technician_recommendations?.length > 0 && (
              <div className="bg-white rounded-lg border border-purple-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-purple-600" />
                  <h4 className="text-[14px] font-semibold text-[#111827]">Recommended Technicians</h4>
                </div>
                <div className="space-y-2">
                  {optimization.technician_recommendations.slice(0, 3).map((tech, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-2 bg-purple-50/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center">
                          <span className="text-[12px] font-semibold text-purple-700">
                            {tech.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-[#111827]">{tech.name}</div>
                          <div className="text-[11px] text-[#6B7280]">
                            {tech.reasons?.slice(0, 2).join(' • ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-100 text-purple-700 border-0">
                          Score: {tech.score}/10
                        </Badge>
                        {onApplyTechnician && idx === 0 && (
                          <Button
                            onClick={() => onApplyTechnician(tech.email)}
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[12px] text-purple-600 hover:bg-purple-100"
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project Timeline */}
            {optimization.project_timeline && (
              <div className="bg-white rounded-lg border border-purple-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <h4 className="text-[14px] font-semibold text-[#111827]">Project Timeline</h4>
                </div>
                
                {optimization.project_timeline.estimated_completion_date && (
                  <div className="mb-3">
                    <span className="text-[12px] text-[#6B7280]">Est. Completion:</span>
                    <span className="text-[14px] font-semibold text-purple-600 ml-2">
                      {formatDate(optimization.project_timeline.estimated_completion_date)}
                    </span>
                  </div>
                )}

                {optimization.project_timeline.remaining_steps?.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[12px] text-[#6B7280] block mb-1.5">Remaining Steps:</span>
                    <div className="space-y-1">
                      {optimization.project_timeline.remaining_steps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[13px] text-[#4B5563]">
                          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-semibold text-purple-600">
                            {idx + 1}
                          </div>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {optimization.project_timeline.bottlenecks?.length > 0 && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
                      <span className="text-[12px] font-medium text-yellow-700">Potential Bottlenecks</span>
                    </div>
                    <ul className="text-[12px] text-yellow-700 space-y-0.5">
                      {optimization.project_timeline.bottlenecks.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Alternative Slots */}
            {optimization.alternative_slots?.length > 0 && (
              <div className="bg-white rounded-lg border border-purple-100 p-4">
                <button
                  onClick={() => setShowAlternatives(!showAlternatives)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <h4 className="text-[14px] font-semibold text-[#111827]">
                      Alternative Time Slots ({optimization.alternative_slots.length})
                    </h4>
                  </div>
                  {showAlternatives ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>
                
                {showAlternatives && (
                  <div className="mt-3 space-y-2">
                    {optimization.alternative_slots.map((slot, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
                        onClick={() => onApplySchedule?.({
                          date: slot.date,
                          time: slot.time
                        })}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] font-medium">{formatDate(slot.date)}</span>
                          <span className="text-[13px] text-[#6B7280]">{slot.time}</span>
                        </div>
                        <div className="text-[12px] text-[#6B7280]">
                          {slot.available_technicians?.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Optimization Tips */}
            {optimization.optimization_tips?.length > 0 && (
              <div className="bg-white rounded-lg border border-purple-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-purple-600" />
                  <h4 className="text-[14px] font-semibold text-[#111827]">Optimization Tips</h4>
                </div>
                <ul className="space-y-1.5">
                  {optimization.optimization_tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[13px] text-[#4B5563]">
                      <span className="text-purple-500 mt-0.5">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Refresh Button */}
            <div className="flex justify-center pt-2">
              <Button
                onClick={handleOptimize}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}