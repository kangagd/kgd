import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, CheckCircle, Clock, Truck, TrendingUp } from "lucide-react";
import { 
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ['#FAE008', '#111827', '#9CA3AF', '#D1D5DB', '#F3F4F6'];

const MetricCard = ({ title, value, icon: Icon, trend, colorClass = "bg-white" }) => (
    <Card className={`${colorClass} border-none shadow-sm`}>
        <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
                    {trend && (
                        <div className="flex items-center mt-1 text-sm text-green-600">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            <span>{trend}</span>
                        </div>
                    )}
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                    <Icon className="w-6 h-6 text-gray-700" />
                </div>
            </div>
        </CardContent>
    </Card>
);

const ChartCard = ({ title, children }) => (
    <Card className="border-none shadow-sm h-[400px]">
        <CardHeader>
            <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
            {children}
        </CardContent>
    </Card>
);

export default function AdminDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['adminDashboardData'],
        queryFn: async () => {
            const response = await base44.functions.invoke('getAdminDashboardData');
            return response.data;
        }
    });

    if (isLoading) {
        return <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] w-full rounded-xl" />
                <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
        </div>;
    }

    const { cards, charts } = data || { cards: {}, charts: {} };

    // Formatting currency
    const formatCurrency = (value) => 
        new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumSignificantDigits: 3 }).format(value);

    return (
        <div className="space-y-8">
            {/* Cards Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Open Jobs" 
                    value={cards.openJobs || 0} 
                    icon={Briefcase}
                />
                <MetricCard 
                    title="Completed (30 Days)" 
                    value={cards.completedJobs30d || 0} 
                    icon={CheckCircle}
                />
                <MetricCard 
                    title="Upcoming Contract SLA" 
                    value={cards.contractSLAWork || 0} 
                    icon={Clock}
                />
                <MetricCard 
                    title="Parts Awaiting Delivery" 
                    value={cards.partsAwaiting || 0} 
                    icon={Truck}
                />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Line Chart: Jobs Completed */}
                <ChartCard title="Jobs Completed Over Time">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.jobsCompleted || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                tickFormatter={(date) => {
                                    const d = new Date(date);
                                    return d.toLocaleDateString('en-AU', { month: 'short' });
                                }}
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis style={{ fontSize: '12px' }} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelFormatter={(date) => new Date(date).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="count" 
                                stroke="#111827" 
                                strokeWidth={2} 
                                dot={{ fill: '#111827' }}
                                activeDot={{ r: 6, fill: '#FAE008' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Bar Chart: Revenue */}
                <ChartCard title="Revenue Over Time">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.revenue || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                tickFormatter={(date) => {
                                    const d = new Date(date);
                                    return d.toLocaleDateString('en-AU', { month: 'short' });
                                }}
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis 
                                tickFormatter={(value) => `$${value/1000}k`}
                                style={{ fontSize: '12px' }}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelFormatter={(date) => new Date(date).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                                formatter={(value) => [formatCurrency(value), 'Revenue']}
                            />
                            <Bar dataKey="total" fill="#FAE008" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Pie Chart: Job Types */}
                <ChartCard title="Active Job Types Distribution">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={charts.jobTypes || []}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {(charts.jobTypes || []).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                iconType="circle"
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
        </div>
    );
}