import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend 
} from "recharts";
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Briefcase, 
  Users, 
  RefreshCw,
  DollarSign
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export default function Analytics() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['analyticsSnapshots'],
    queryFn: () => base44.entities.AnalyticsSnapshot.list('-snapshot_date', 30), // Last 30 snapshots
    refetchInterval: 60000
  });

  const generateSnapshotMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateAnalyticsSnapshot'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyticsSnapshots'] });
      toast.success("Analytics snapshot generated");
    },
    onError: () => toast.error("Failed to generate snapshot")
  });

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500">Loading analytics...</div>;
  }

  if (user && user.role !== 'admin') {
      return (
          <div className="p-10 text-center">
              <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
              <p className="text-gray-600">Only administrators can view analytics.</p>
          </div>
      );
  }

  const latest = snapshots[0] || {};
  
  // Prepare chart data (reverse to show chronological order)
  const chartData = [...snapshots].reverse().map(s => ({
    date: format(parseISO(s.snapshot_date), 'MMM d'),
    jobs: s.jobs_completed_this_month || 0,
    revenue: s.revenue_this_month || 0,
    sla: s.sla_breaches_this_month || 0
  }));

  return (
    <div className="p-4 lg:p-10 max-w-7xl mx-auto bg-[#f8f9fa] min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#111827]">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {latest.generated_at 
              ? `Last updated: ${format(parseISO(latest.generated_at), 'MMM d, h:mm a')}`
              : 'No data available'}
          </p>
        </div>
        <Button 
            onClick={() => generateSnapshotMutation.mutate()} 
            disabled={generateSnapshotMutation.isPending}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
        >
            <RefreshCw className={`w-4 h-4 mr-2 ${generateSnapshotMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh Data
        </Button>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Total Active Jobs</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-2">{latest.total_jobs || 0}</h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Briefcase className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
                    <span className="font-medium text-green-600">{latest.jobs_completed_this_month || 0}</span>
                    <span className="ml-1">completed this month</span>
                </div>
            </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Monthly Revenue</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-2">
                            ${(latest.revenue_this_month || 0).toLocaleString()}
                        </h3>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                        <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                    Estimated from completed projects
                </div>
            </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">SLA Breaches</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-2">{latest.sla_breaches_this_month || 0}</h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                </div>
                 <div className="mt-4 text-sm text-gray-500">
                    This month
                </div>
            </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Avg Job Duration</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-2">{latest.average_job_duration || 0} min</h3>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-lg">
                        <ClockIcon className="w-6 h-6 text-purple-600" />
                    </div>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                    Based on checkout times
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card>
            <CardHeader>
                <CardTitle>Job Completion Trend</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="jobs" stroke="#2563EB" strokeWidth={2} name="Completed Jobs" />
                            <Line type="monotone" dataKey="sla" stroke="#DC2626" strokeWidth={2} name="SLA Breaches" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#10B981" name="Revenue" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Technician Performance (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                <th className="pb-3 font-semibold text-gray-600">Technician</th>
                                <th className="pb-3 font-semibold text-gray-600 text-right">Jobs Completed</th>
                                <th className="pb-3 font-semibold text-gray-600 text-right">SLA Breaches</th>
                                <th className="pb-3 font-semibold text-gray-600 text-right">Efficiency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(latest.technician_performance || {}).map(([email, stats], idx) => (
                                <tr key={email} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="py-3 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-700">
                                            {email.slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-gray-900">{email}</span>
                                    </td>
                                    <td className="py-3 text-right font-medium">{stats.completed}</td>
                                    <td className="py-3 text-right text-red-600 font-medium">{stats.sla_breach_count}</td>
                                    <td className="py-3 text-right">
                                        {stats.completed > 0 
                                            ? `${Math.round((1 - (stats.sla_breach_count / stats.completed)) * 100)}%` 
                                            : '-'}
                                    </td>
                                </tr>
                            ))}
                            {Object.keys(latest.technician_performance || {}).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-gray-500">No data available</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Top Job Types</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {(latest.top_job_types || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 text-sm text-gray-400">#{idx + 1}</span>
                                <span className="font-medium text-gray-700">{item.type}</span>
                            </div>
                            <span className="font-bold text-gray-900">{item.count}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClockIcon({ className }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}