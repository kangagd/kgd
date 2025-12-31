import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sparkles,
  AlertTriangle,
  UserPlus,
  Route,
  RefreshCw,
  ChevronRight,
  Clock,
  MapPin,
  Wrench,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Shuffle,
  Zap,
  TrendingUp,
  Calendar,
  User
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const severityColors = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200"
};

const healthColors = {
  good: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100" },
  needs_attention: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100" },
  critical: { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100" }
};

export default function AISchedulingAssistant({ selectedDate, onApplySuggestion }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  const dateStr = selectedDate 
    ? format(selectedDate, 'yyyy-MM-dd') 
    : format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['aiScheduling', dateStr],
    queryFn: async () => {
      const response = await base44.functions.invoke('aiSchedulingAssistant', { date: dateStr });
      return response.data;
    },
    enabled: open,
    staleTime: 60000 // Cache for 1 minute
  });

  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, technicianEmail, technicianName, scheduledTime }) => {
      const updateData = {
        assigned_to: [technicianEmail],
        assigned_to_name: [technicianName],
        scheduled_date: dateStr,
        status: 'Scheduled'
      };
      if (scheduledTime) {
        updateData.scheduled_time = scheduledTime;
      }
      await base44.entities.Job.update(jobId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiScheduling'] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success("Job assigned successfully");
      if (onApplySuggestion) onApplySuggestion();
    },
    onError: (error) => {
      toast.error("Failed to assign job: " + error.message);
    }
  });

  const reassignJobMutation = useMutation({
    mutationFn: async ({ jobId, fromTechnician, toTechnician, toTechnicianName, scheduledTime }) => {
      const updateData = {
        assigned_to: [toTechnician],
        assigned_to_name: [toTechnicianName]
      };
      if (scheduledTime) {
        updateData.scheduled_time = scheduledTime;
      }
      await base44.entities.Job.update(jobId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiScheduling'] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success("Job reassigned successfully");
      if (onApplySuggestion) onApplySuggestion();
    },
    onError: (error) => {
      toast.error("Failed to reassign job: " + error.message);
    }
  });

  const autoDispatchMutation = useMutation({
    mutationFn: async (recommendations) => {
      for (const rec of recommendations) {
        await base44.entities.Job.update(rec.jobId, {
          assigned_to: [rec.technicianEmail],
          assigned_to_name: [rec.technicianName],
          scheduled_date: rec.suggestedDate,
          scheduled_time: rec.suggestedTime,
          status: 'Scheduled'
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['aiScheduling'] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success(`${variables.length} jobs auto-dispatched successfully`);
      if (onApplySuggestion) onApplySuggestion();
    },
    onError: (error) => {
      toast.error("Failed to auto-dispatch: " + error.message);
    }
  });

  const applyRouteMutation = useMutation({
    mutationFn: async ({ route }) => {
      for (const stop of route) {
        await base44.entities.Job.update(stop.jobId, {
          scheduled_time: stop.suggestedTime
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiScheduling'] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success("Route times applied successfully");
      if (onApplySuggestion) onApplySuggestion();
    },
    onError: (error) => {
      toast.error("Failed to apply route: " + error.message);
    }
  });

  const health = data?.summary?.overallHealth || 'good';
  const healthStyle = healthColors[health];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
          title="AI Scheduling Assistant"
        >
          <Sparkles className="w-4 h-4 text-[#D97706]" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D97706]" />
              AI Scheduling Assistant
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-sm text-[#6B7280]">
            {format(new Date(dateStr), 'EEEE, MMMM d, yyyy')}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#FAE008] mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">Analyzing schedule...</p>
              </div>
            </div>
          ) : data?.error ? (
            <div className="p-6 text-center">
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-600">{data.error}</p>
            </div>
          ) : (
            <>
              {/* Summary Card */}
              {data?.summary && (
                <div className={`mx-4 mt-4 p-4 rounded-xl ${healthStyle.bg} border`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${healthStyle.badge}`}>
                      {health === 'good' ? (
                        <CheckCircle className={`w-5 h-5 ${healthStyle.text}`} />
                      ) : health === 'critical' ? (
                        <XCircle className={`w-5 h-5 ${healthStyle.text}`} />
                      ) : (
                        <AlertTriangle className={`w-5 h-5 ${healthStyle.text}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${healthStyle.text} mb-1`}>
                        {health === 'good' ? 'Schedule looks good' : 
                         health === 'critical' ? 'Critical issues detected' : 
                         'Needs attention'}
                      </p>
                      <p className="text-sm text-[#4B5563]">{data.summary.summary}</p>
                      {data.summary.priorityActions?.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {data.summary.priorityActions.map((action, i) => (
                            <li key={i} className="text-xs text-[#6B7280] flex items-start gap-1">
                              <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 px-4 py-4">
                <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
                  <p className="text-lg font-semibold text-[#111827]">{data?.stats?.totalTechnicians || 0}</p>
                  <p className="text-[10px] text-[#6B7280]">Technicians</p>
                </div>
                <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
                  <p className="text-lg font-semibold text-[#111827]">{data?.stats?.scheduledJobs || 0}</p>
                  <p className="text-[10px] text-[#6B7280]">Scheduled</p>
                </div>
                <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
                  <p className="text-lg font-semibold text-amber-600">{data?.stats?.unassignedJobs || 0}</p>
                  <p className="text-[10px] text-[#6B7280]">Unassigned</p>
                </div>
                <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
                  <p className="text-lg font-semibold text-red-600">{data?.stats?.conflictsDetected || 0}</p>
                  <p className="text-[10px] text-[#6B7280]">Conflicts</p>
                </div>
              </div>

              {/* Auto-Dispatch Banner */}
              {data?.autoDispatchRecommendations?.length > 0 && (
                <div className="mx-4 mb-4 p-3 bg-gradient-to-r from-[#FAE008]/20 to-[#FAE008]/5 border border-[#FAE008] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#FAE008] rounded-lg">
                        <Zap className="w-4 h-4 text-[#111827]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#111827]">
                          {data.autoDispatchRecommendations.length} jobs ready for auto-dispatch
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          High-confidence matches with optimal time slots
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => autoDispatchMutation.mutate(data.autoDispatchRecommendations)}
                      disabled={autoDispatchMutation.isPending}
                      className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                    >
                      {autoDispatchMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-1" />
                          Auto-Dispatch All
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="overview" className="text-xs px-2">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Conflicts</span>
                    {data?.conflicts?.length > 0 && (
                      <Badge className="ml-1 bg-red-500 text-white text-[9px] px-1 py-0">{data.conflicts.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="assignments" className="text-xs px-2">
                    <UserPlus className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Assign</span>
                    {data?.assignmentSuggestions?.length > 0 && (
                      <Badge className="ml-1 bg-amber-500 text-white text-[9px] px-1 py-0">{data.assignmentSuggestions.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="reassign" className="text-xs px-2">
                    <Shuffle className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Optimize</span>
                    {(data?.reassignmentSuggestions?.length || 0) > 0 && (
                      <Badge className="ml-1 bg-blue-500 text-white text-[9px] px-1 py-0">{data?.reassignmentSuggestions?.length || 0}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="routes" className="text-xs px-2">
                    <Route className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Routes</span>
                  </TabsTrigger>
                </TabsList>

                {/* Conflicts Tab */}
                <TabsContent value="overview" className="mt-4 space-y-3">
                  {data?.conflicts?.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                      <p className="text-sm text-[#6B7280]">No scheduling conflicts detected</p>
                    </div>
                  ) : (
                    data?.conflicts?.map((conflict, i) => (
                      <Card key={i} className={`border ${severityColors[conflict.severity]}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{conflict.technician}</p>
                              <p className="text-xs mt-1">{conflict.message}</p>
                              <p className="text-xs text-[#6B7280] mt-2 italic">{conflict.suggestedFix}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* Assignments Tab */}
                <TabsContent value="assignments" className="mt-4 space-y-3">
                  {data?.assignmentSuggestions?.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                      <p className="text-sm text-[#6B7280]">All jobs are assigned</p>
                    </div>
                  ) : (
                    data?.assignmentSuggestions?.map((suggestion, i) => (
                      <Card key={i} className={`border ${suggestion.confidence === 'high' ? 'border-green-200 bg-green-50/30' : 'border-[#E5E7EB]'}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Job #{suggestion.job.jobNumber}</p>
                                {suggestion.confidence === 'high' && (
                                  <Badge className="bg-green-100 text-green-700 text-[9px]">
                                    <Zap className="w-2.5 h-2.5 mr-0.5" />
                                    Best Match
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-[#6B7280]">{suggestion.job.customer}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">
                                  <Wrench className="w-2.5 h-2.5 mr-1" />
                                  {suggestion.job.jobType || 'General'}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  <MapPin className="w-2.5 h-2.5 mr-1" />
                                  {suggestion.job.address}
                                </Badge>
                                {suggestion.job.expectedDuration && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Clock className="w-2.5 h-2.5 mr-1" />
                                    {suggestion.job.expectedDuration}h
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 p-2 bg-[#F9FAFB] rounded-lg">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-[#6B7280]">Recommended</p>
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FAE008]/30 text-[#111827]">
                                    {suggestion.recommendedTechnician.score}% match
                                  </span>
                                </div>
                                <p className="text-sm font-medium">{suggestion.recommendedTechnician.name}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                  <span className="text-[10px] text-[#6B7280]">
                                    🎯 Skill: {suggestion.recommendedTechnician.breakdown?.skill || 0}%
                                  </span>
                                  <span className="text-[10px] text-[#6B7280]">
                                    📍 Proximity: {suggestion.recommendedTechnician.breakdown?.proximity || 0}%
                                  </span>
                                  <span className="text-[10px] text-[#6B7280]">
                                    📊 Load: {suggestion.recommendedTechnician.currentJobs}/{suggestion.recommendedTechnician.maxJobs}
                                  </span>
                                </div>
                                {suggestion.recommendedTechnician.suggestedTimeSlot && (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <Calendar className="w-3 h-3 text-green-600" />
                                    <span className="text-xs text-green-700 font-medium">
                                      {suggestion.recommendedTechnician.suggestedTimeSlot.suggestedTime}
                                    </span>
                                    <span className="text-[10px] text-[#6B7280]">
                                      - {suggestion.recommendedTechnician.suggestedTimeSlot.reason}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => assignJobMutation.mutate({
                                  jobId: suggestion.job.id,
                                  technicianEmail: suggestion.recommendedTechnician.email,
                                  technicianName: suggestion.recommendedTechnician.name,
                                  scheduledTime: suggestion.recommendedTechnician.suggestedTimeSlot?.suggestedTime
                                })}
                                disabled={assignJobMutation.isPending}
                                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] h-8"
                              >
                                {assignJobMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>Assign</>
                                )}
                              </Button>
                            </div>
                            
                            <p className="text-[10px] text-[#6B7280] mt-2 italic">{suggestion.reason}</p>
                          </div>

                          {suggestion.alternatives?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
                              <p className="text-[10px] text-[#6B7280] mb-1">Alternative options:</p>
                              <div className="flex flex-wrap gap-1">
                                {suggestion.alternatives.map((alt, j) => (
                                  <Button
                                    key={j}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 bg-[#F3F4F6] hover:bg-[#E5E7EB]"
                                    onClick={() => assignJobMutation.mutate({
                                      jobId: suggestion.job.id,
                                      technicianEmail: alt.email,
                                      technicianName: alt.name,
                                      scheduledTime: alt.suggestedTimeSlot?.suggestedTime
                                    })}
                                    disabled={assignJobMutation.isPending}
                                  >
                                    {alt.name} ({alt.score}%)
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* Reassignment Suggestions Tab */}
                <TabsContent value="reassign" className="mt-4 space-y-3">
                  {!data?.reassignmentSuggestions || data?.reassignmentSuggestions?.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                      <p className="text-sm text-[#6B7280]">All assignments are optimized</p>
                      <p className="text-xs text-[#9CA3AF] mt-1">No better technician matches found</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-700">Optimization Opportunities</p>
                            <p className="text-xs text-blue-600">
                              {data?.reassignmentSuggestions?.length || 0} job(s) could be better matched with different technicians
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {data?.reassignmentSuggestions?.map((suggestion, i) => (
                        <Card key={i} className={`border ${suggestion.severity === 'high' ? 'border-blue-300 bg-blue-50/30' : 'border-[#E5E7EB]'}`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">Job #{suggestion.job.jobNumber}</p>
                                  <Badge className={`text-[9px] ${suggestion.severity === 'high' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                    +{suggestion.suggestedReassignment.improvement}% better
                                  </Badge>
                                </div>
                                <p className="text-xs text-[#6B7280]">{suggestion.job.customer}</p>
                                {suggestion.job.jobType && (
                                  <Badge variant="outline" className="text-[10px] mt-1">
                                    <Wrench className="w-2.5 h-2.5 mr-1" />
                                    {suggestion.job.jobType}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-[#E5E7EB]">
                              <div className="flex-1 text-center px-2">
                                <p className="text-[10px] text-[#9CA3AF]">Current</p>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <User className="w-3 h-3 text-[#6B7280]" />
                                  <p className="text-xs font-medium text-[#6B7280]">{suggestion.currentAssignment.name}</p>
                                </div>
                                <p className="text-[10px] text-[#9CA3AF]">{suggestion.currentAssignment.score}% match</p>
                              </div>
                              
                              <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              
                              <div className="flex-1 text-center px-2">
                                <p className="text-[10px] text-blue-600">Suggested</p>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <User className="w-3 h-3 text-blue-600" />
                                  <p className="text-xs font-medium text-blue-700">{suggestion.suggestedReassignment.name}</p>
                                </div>
                                <p className="text-[10px] text-blue-600">{suggestion.suggestedReassignment.score}% match</p>
                              </div>
                            </div>
                            
                            <p className="text-[10px] text-[#6B7280] mt-2 italic">{suggestion.reason}</p>
                            
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={() => reassignJobMutation.mutate({
                                  jobId: suggestion.job.id,
                                  fromTechnician: suggestion.currentAssignment.email,
                                  toTechnician: suggestion.suggestedReassignment.email,
                                  toTechnicianName: suggestion.suggestedReassignment.name,
                                  scheduledTime: suggestion.suggestedReassignment.suggestedTime
                                })}
                                disabled={reassignJobMutation.isPending}
                                className="flex-1 bg-blue-600 text-white hover:bg-blue-700 h-8"
                              >
                                {reassignJobMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <Shuffle className="w-3 h-3 mr-1" />
                                    Reassign
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </TabsContent>

                {/* Routes Tab */}
                <TabsContent value="routes" className="mt-4 space-y-3 pb-4">
                  {data?.optimizedRoutes?.length === 0 ? (
                    <div className="text-center py-8">
                      <Route className="w-10 h-10 text-[#E5E7EB] mx-auto mb-2" />
                      <p className="text-sm text-[#6B7280]">No routes to optimize</p>
                    </div>
                  ) : (
                    data?.optimizedRoutes?.map((route, i) => (
                      <Card key={i} className="border border-[#E5E7EB]">
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm">{route.technician.name}</CardTitle>
                              <p className="text-xs text-[#6B7280]">
                                {route.jobCount} jobs • {route.totalDistanceKm} km • ~{route.totalTravelTimeMinutes} min travel
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applyRouteMutation.mutate({ route: route.route })}
                              disabled={applyRouteMutation.isPending}
                              className="h-7 text-xs"
                            >
                              {applyRouteMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>Apply Times</>
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <div className="space-y-2">
                            {route.route.map((stop, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs">
                                <div className="w-5 h-5 rounded-full bg-[#FAE008] text-[#111827] flex items-center justify-center font-medium text-[10px]">
                                  {stop.order}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">Job #{stop.jobNumber}</p>
                                  <p className="text-[#6B7280] truncate">{stop.address}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {stop.currentTime !== stop.suggestedTime ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[#9CA3AF] line-through">{stop.currentTime || '--:--'}</span>
                                      <ArrowRight className="w-3 h-3 text-[#6B7280]" />
                                      <span className="text-green-600 font-medium">{stop.suggestedTime}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[#6B7280]">{stop.suggestedTime}</span>
                                  )}
                                  {stop.travelTimeFromPrevious > 0 && (
                                    <p className="text-[10px] text-[#9CA3AF]">
                                      +{stop.travelTimeFromPrevious} min drive
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}