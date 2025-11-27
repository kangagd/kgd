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
    mutationFn: async ({ jobId, technicianEmail, technicianName }) => {
      await base44.entities.Job.update(jobId, {
        assigned_to: [technicianEmail],
        assigned_to_name: [technicianName],
        scheduled_date: dateStr,
        status: 'Scheduled'
      });
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
          className="gap-2 border-[#FAE008] bg-[#FFFEF5] hover:bg-[#FAE008]/20 text-[#111827]"
        >
          <Sparkles className="w-4 h-4 text-[#D97706]" />
          AI Assistant
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

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1 text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Conflicts
                    {data?.conflicts?.length > 0 && (
                      <Badge className="ml-1 bg-red-500 text-white text-[9px] px-1 py-0">{data.conflicts.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="assignments" className="flex-1 text-xs">
                    <UserPlus className="w-3 h-3 mr-1" />
                    Assign
                    {data?.assignmentSuggestions?.length > 0 && (
                      <Badge className="ml-1 bg-amber-500 text-white text-[9px] px-1 py-0">{data.assignmentSuggestions.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="routes" className="flex-1 text-xs">
                    <Route className="w-3 h-3 mr-1" />
                    Routes
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
                      <Card key={i} className="border border-[#E5E7EB]">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-medium">Job #{suggestion.job.jobNumber}</p>
                              <p className="text-xs text-[#6B7280]">{suggestion.job.customer}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">
                                  <Wrench className="w-2.5 h-2.5 mr-1" />
                                  {suggestion.job.jobType || 'General'}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  <MapPin className="w-2.5 h-2.5 mr-1" />
                                  {suggestion.job.address}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-3 p-2 bg-[#F9FAFB] rounded-lg">
                            <div className="flex-1">
                              <p className="text-xs text-[#6B7280]">Recommended</p>
                              <p className="text-sm font-medium">{suggestion.recommendedTechnician.name}</p>
                              <div className="flex gap-2 mt-1">
                                <span className="text-[10px] text-[#6B7280]">
                                  Skill: {suggestion.recommendedTechnician.skillMatch}%
                                </span>
                                <span className="text-[10px] text-[#6B7280]">
                                  Proximity: {suggestion.recommendedTechnician.proximity}%
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => assignJobMutation.mutate({
                                jobId: suggestion.job.id,
                                technicianEmail: suggestion.recommendedTechnician.email,
                                technicianName: suggestion.recommendedTechnician.name
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

                          {suggestion.alternatives?.length > 0 && (
                            <div className="mt-2 text-xs text-[#6B7280]">
                              <span>Also available: </span>
                              {suggestion.alternatives.map((alt, j) => (
                                <span key={j}>
                                  {alt.name} ({alt.skillMatch}%)
                                  {j < suggestion.alternatives.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
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