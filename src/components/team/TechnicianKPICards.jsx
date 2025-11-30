import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    RotateCcw, 
    TrendingUp, 
    RefreshCw 
} from "lucide-react";
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    BarChart,
    Bar
} from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function TechnicianKPICards({ user }) {
    const queryClient = useQueryClient();
    const kpis = user?.technician_kpis || {};

    const calculateMutation = useMutation({
        mutationFn: () => base44.functions.invoke('calculateTechnicianKPIs', { userId: user.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] }); // Reload user to get new KPIs
            toast.success("KPIs updated");
        },
        onError: (err) => {
            toast.error("Failed to update KPIs");
        }
    });

    // Auto-calculate if missing or old (older than 24h)
    useEffect(() => {
        const lastUpdated = kpis.last_updated ? new Date(kpis.last_updated) : null;
        const oneDayAgo = new Date(Date.now() - 86400000);
        
        if (!lastUpdated || lastUpdated < oneDayAgo) {
            calculateMutation.mutate();
        }
    }, [user.id]);

    if (!user.is_field_technician) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Performance Metrics
                </h3>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => calculateMutation.mutate()}
                    disabled={calculateMutation.isPending}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${calculateMutation.isPending ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-green-50 border-green-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-green-700">Jobs Completed</p>
                                <h4 className="text-2xl font-bold text-green-900 mt-2">
                                    {kpis.jobs_completed_count || 0}
                                </h4>
                            </div>
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-700" />
                            </div>
                        </div>
                        <p className="text-xs text-green-600 mt-2">Lifetime total</p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-blue-700">On-Time Check-ins</p>
                                <h4 className="text-2xl font-bold text-blue-900 mt-2">
                                    {kpis.on_time_checkin_rate || 0}%
                                </h4>
                            </div>
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Clock className="w-5 h-5 text-blue-700" />
                            </div>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">Within 15 mins of schedule</p>
                    </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-purple-700">Duration Accuracy</p>
                                <h4 className="text-2xl font-bold text-purple-900 mt-2">
                                    {kpis.avg_duration_variance > 0 ? '+' : ''}{Math.round((kpis.avg_duration_variance || 0) * 100)}%
                                </h4>
                            </div>
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-purple-700" />
                            </div>
                        </div>
                        <p className="text-xs text-purple-600 mt-2">Vs. Estimated Duration</p>
                    </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-orange-700">Re-visit Rate</p>
                                <h4 className="text-2xl font-bold text-orange-900 mt-2">
                                    {kpis.revisit_rate || 0}%
                                </h4>
                            </div>
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <RotateCcw className="w-5 h-5 text-orange-700" />
                            </div>
                        </div>
                        <p className="text-xs text-orange-600 mt-2">Jobs requiring return visit</p>
                    </CardContent>
                </Card>
            </div>

            {/* Historical Chart */}
            {kpis.history && kpis.history.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Performance History (Last 12 Months)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={kpis.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tick={{fontSize: 12}} />
                                    <YAxis yAxisId="left" orientation="left" stroke="#16a34a" />
                                    <YAxis yAxisId="right" orientation="right" stroke="#2563eb" />
                                    <Tooltip />
                                    <Bar yAxisId="left" dataKey="jobs_completed" name="Jobs" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="on_time_rate" name="On-Time %" stroke="#2563eb" strokeWidth={2} dot={{r: 4}} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}