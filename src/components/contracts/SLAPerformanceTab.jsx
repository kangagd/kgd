import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { CheckCircle2, AlertTriangle, Clock, AlertCircle } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function SLAPerformanceTab({ contract, jobs }) {
  const queryClient = useQueryClient();
  
  // Filter jobs relevant to SLA (those with sla_due_at)
  const slaJobs = jobs.filter(j => j.sla_due_at);
  
  const metCount = slaJobs.filter(j => j.sla_met === true).length;
  const breachedCount = slaJobs.filter(j => j.sla_met === false).length;
  const pendingCount = slaJobs.filter(j => j.sla_met === undefined || j.sla_met === null).length;
  
  const complianceRate = (metCount + breachedCount) > 0 
    ? Math.round((metCount / (metCount + breachedCount)) * 100)
    : 0;

  const pieData = [
    { name: 'Met', value: metCount, color: '#22c55e' },
    { name: 'Breached', value: breachedCount, color: '#ef4444' },
    { name: 'Pending', value: pendingCount, color: '#eab308' },
  ].filter(d => d.value > 0);

  const breaches = slaJobs
    .filter(j => j.sla_met === false)
    .sort((a, b) => new Date(b.sla_due_at) - new Date(a.sla_due_at));

  const recalculateSLAMutation = useMutation({
    mutationFn: async () => {
        // Only process jobs that might need update (e.g. completed but no SLA met status, or open with SLA due)
        // For simplicity, we'll trigger for all contract jobs to be safe, or just the visible ones
        const promises = jobs.map(job => base44.functions.invoke('updateJobSLA', { job_id: job.id }));
        await Promise.all(promises);
    },
    onSuccess: () => {
        toast.success("SLA stats updated");
        queryClient.invalidateQueries(['contractJobs', contract.id]);
    },
    onError: () => toast.error("Failed to update SLA stats")
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-[#111827]">SLA Performance</h2>
           <p className="text-sm text-gray-500">Contract Target: {contract.sla_response_time_hours}h Response Time</p>
        </div>
        <Button 
            variant="outline" 
            onClick={() => recalculateSLAMutation.mutate()}
            disabled={recalculateSLAMutation.isPending}
        >
            {recalculateSLAMutation.isPending ? 'Updating...' : 'Recalculate Stats'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Compliance Card */}
        <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">SLA Compliance</p>
                        <h3 className={`text-3xl font-bold mt-2 ${complianceRate >= 90 ? 'text-green-600' : complianceRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {complianceRate}%
                        </h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <CheckCircle2 className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                    {metCount} met / {metCount + breachedCount} total completed
                </div>
            </CardContent>
        </Card>

        {/* Breaches Card */}
        <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Total Breaches</p>
                        <h3 className="text-3xl font-bold text-red-600 mt-2">{breachedCount}</h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                    Requires attention
                </div>
            </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
            <CardContent className="p-4 h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="middle" align="right" layout="vertical" />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      {/* Breaches Table */}
      <Card>
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Breach List
            </CardTitle>
        </CardHeader>
        <CardContent>
            {breaches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    No SLA breaches recorded.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 border-b bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 font-medium">Job</th>
                                <th className="px-4 py-3 font-medium">Station</th>
                                <th className="px-4 py-3 font-medium">Due Date</th>
                                <th className="px-4 py-3 font-medium">Technician</th>
                                <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {breaches.map(job => (
                                <tr key={job.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium">#{job.job_number}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.customer_name}</td>
                                    <td className="px-4 py-3 text-red-600">
                                        {format(parseISO(job.sla_due_at), 'MMM d, HH:mm')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {(job.assigned_to || []).map((email, idx) => (
                                                <div key={idx} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-[10px] font-bold" title={email}>
                                                    {email.substring(0, 2).toUpperCase()}
                                                </div>
                                            ))}
                                            {(!job.assigned_to || job.assigned_to.length === 0) && <span className="text-gray-400">-</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => window.location.href = createPageUrl('Jobs') + `?jobId=${job.id}`}
                                        >
                                            View
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}