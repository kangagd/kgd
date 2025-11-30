import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, DollarSign, Wrench } from "lucide-react";
import { format, parseISO } from "date-fns";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ContractAnalyticsTab({ contract }) {
    const { data: analytics, isLoading } = useQuery({
        queryKey: ['contractAnalytics', contract.id],
        queryFn: async () => {
            const res = await base44.functions.invoke('generateContractAnalytics', { contractId: contract.id });
            if (res.data?.error) throw new Error(res.data.error);
            return res.data;
        }
    });

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading analytics data...</div>;
    }

    if (!analytics) return <div className="p-8 text-center">No data available</div>;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">SLA Breaches</p>
                            <h3 className="text-2xl font-bold text-red-600">{analytics.slaBreachesTotal}</h3>
                        </div>
                        <div className="p-3 bg-red-50 rounded-full">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Parts Replaced</p>
                            <h3 className="text-2xl font-bold text-blue-600">{analytics.totalPartsReplaced}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-full">
                            <Wrench className="w-5 h-5 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Spend (YTD)</p>
                            <h3 className="text-2xl font-bold text-green-600">
                                ${analytics.monthlySpend.reduce((acc, curr) => acc + curr.total, 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-full">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Pending Jobs</p>
                            <h3 className="text-2xl font-bold text-amber-600">{analytics.outstandingWork.length}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-full">
                            <CheckCircle2 className="w-5 h-5 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Work by Station (Top 10)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.workByStation} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={100} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Jobs" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>SLA Performance Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={analytics.slaPerformance}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="percentage" name="SLA Met %" stroke="#10B981" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Monthly Spend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.monthlySpend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                                    <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} name="Amount" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Job Type Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.jobTypeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {analytics.jobTypeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Outstanding Work Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Outstanding Work</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Job #</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Station</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Scheduled</TableHead>
                                <TableHead>SLA Due</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {analytics.outstandingWork.length > 0 ? (
                                analytics.outstandingWork.slice(0, 10).map((job) => (
                                    <TableRow key={job.id}>
                                        <TableCell className="font-medium">{job.job_number}</TableCell>
                                        <TableCell>{job.title}</TableCell>
                                        <TableCell>{job.station}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{job.status}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {job.date ? format(parseISO(job.date), 'MMM d') : '-'}
                                        </TableCell>
                                        <TableCell className={job.sla_due && new Date(job.sla_due) < new Date() ? 'text-red-600 font-medium' : ''}>
                                            {job.sla_due ? format(parseISO(job.sla_due), 'MMM d HH:mm') : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                                        No outstanding work
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {analytics.outstandingWork.length > 10 && (
                        <div className="mt-4 text-center text-sm text-gray-500">
                            Showing 10 of {analytics.outstandingWork.length} pending jobs
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}