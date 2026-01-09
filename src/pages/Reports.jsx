import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import AccessDenied from "@/components/common/AccessDenied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectStageFunnelReport from "@/components/reports/ProjectStageFunnelReport";
import JobStatusSummaryReport from "@/components/reports/JobStatusSummaryReport";
import { filterRecordsByDateRange } from "@/components/domain/reportingHelpers";
import DateRangeSelector from "@/components/reports/DateRangeSelector";
import RequirePermission from "@/components/common/RequirePermission";
import BackButton from "@/components/common/BackButton";
import { createPageUrl } from "@/utils";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  TrendingUp,
  Users,
  DollarSign,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle
} from "lucide-react";

const COLORS = ['#FAE008', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Reports() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [reportDateRange, setReportDateRange] = useState("6m");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const hasAccess = user?.role === 'admin';
  const shouldFetch = !loading && hasAccess;

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
    enabled: shouldFetch
  });

  const { data: allJobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: shouldFetch
  });

  const { data: allParts = [] } = useQuery({
    queryKey: ['allParts'],
    queryFn: () => base44.entities.Part.list(),
    enabled: shouldFetch
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: shouldFetch
  });

  const { data: checkInOuts = [] } = useQuery({
    queryKey: ['checkInOuts'],
    queryFn: () => base44.entities.CheckInOut.list(),
    enabled: shouldFetch
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list(),
    enabled: shouldFetch
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
    enabled: shouldFetch
  });

  const filteredProjects = useMemo(() => {
    return allProjects.filter(p => {
      if (p.deleted_at) return false;
      
      const createdDate = new Date(p.created_date);
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      
      if (createdDate < fromDate || createdDate > toDate) return false;
      
      if (projectStatusFilter !== "all" && p.status !== projectStatusFilter) return false;
      
      return true;
    });
  }, [allProjects, dateFrom, dateTo, projectStatusFilter]);

  const filteredJobs = useMemo(() => {
    return allJobs.filter(j => {
      if (j.deleted_at) return false;
      const d = new Date(j.created_date);
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      return d >= from && d <= to;
    });
  }, [allJobs, dateFrom, dateTo]);

  // Project completion metrics
  const projectMetrics = useMemo(() => {
    const total = filteredProjects.length;
    const completed = filteredProjects.filter(p => p.status === 'Completed').length;
    const inProgress = filteredProjects.filter(p => 
      p.status !== 'Completed' && p.status !== 'Lead'
    ).length;
    const leads = filteredProjects.filter(p => p.status === 'Lead').length;
    
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    
    return { total, completed, inProgress, leads, completionRate };
  }, [filteredProjects]);

  // Project status breakdown
  const projectStatusData = useMemo(() => {
    const statusCounts = {};
    filteredProjects.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count
    }));
  }, [filteredProjects]);

  // Revenue by project type
  const revenueByType = useMemo(() => {
    const typeRevenue = {};
    
    filteredProjects.forEach(p => {
      if (p.project_type && p.quote_value) {
        const type = p.project_type;
        typeRevenue[type] = (typeRevenue[type] || 0) + p.quote_value;
      }
    });
    
    return Object.entries(typeRevenue).map(([type, revenue]) => ({
      type,
      revenue: Math.round(revenue)
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredProjects]);

  // Total revenue
  const totalRevenue = useMemo(() => {
    return filteredProjects.reduce((sum, p) => sum + (p.quote_value || 0), 0);
  }, [filteredProjects]);

  // Technician performance
  const technicianPerformance = useMemo(() => {
    const techStats = {};
    
    technicians.forEach(tech => {
      techStats[tech.email] = {
        name: tech.full_name,
        email: tech.email,
        jobsCompleted: 0,
        totalHours: 0
      };
    });
    
    const filteredJobsForTech = allJobs.filter(j => {
      const scheduledDate = new Date(j.scheduled_date);
      return scheduledDate >= new Date(dateFrom) && scheduledDate <= new Date(dateTo);
    });
    
    filteredJobsForTech.forEach(job => {
      if (job.status === 'Completed' && job.assigned_to) {
        const techs = Array.isArray(job.assigned_to) ? job.assigned_to : [job.assigned_to];
        techs.forEach(email => {
          if (techStats[email]) {
            techStats[email].jobsCompleted++;
          }
        });
      }
    });
    
    checkInOuts.forEach(co => {
      if (co.duration_hours && techStats[co.technician_email]) {
        techStats[co.technician_email].totalHours += co.duration_hours;
      }
    });
    
    return Object.values(techStats)
      .filter(tech => tech.jobsCompleted > 0 || tech.totalHours > 0)
      .sort((a, b) => b.jobsCompleted - a.jobsCompleted);
  }, [technicians, allJobs, checkInOuts, dateFrom, dateTo]);

  // Inventory status
  const inventoryStatus = useMemo(() => {
    const lowStock = priceListItems.filter(item => 
      item.in_inventory && 
      item.stock_level <= item.min_stock_level
    ).length;
    
    const outOfStock = priceListItems.filter(item => 
      item.in_inventory && 
      item.stock_level === 0
    ).length;
    
    const inStock = priceListItems.filter(item => 
      item.in_inventory && 
      item.stock_level > item.min_stock_level
    ).length;
    
    return { lowStock, outOfStock, inStock, total: priceListItems.length };
  }, [priceListItems]);

  // Parts order status
  const partsOrderStatus = useMemo(() => {
    const statusCounts = {
      'Pending': 0,
      'Ordered': 0,
      'Back-ordered': 0,
      'Delivered': 0
    };
    
    allParts.forEach(part => {
      if (statusCounts.hasOwnProperty(part.status)) {
        statusCounts[part.status]++;
      }
    });
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));
  }, [allParts]);

  // Contract Metrics
  const contractMetrics = useMemo(() => {
    const totalContractJobs = allJobs.filter(j => j.is_contract_job).length;
    const completedContractJobs = allJobs.filter(j => j.is_contract_job && j.status === 'Completed').length;
    const slaBreaches = allJobs.filter(j => j.is_contract_job && j.sla_due_at && new Date(j.sla_due_at) < new Date() && j.status !== 'Completed').length;
    
    const slaCompliance = totalContractJobs > 0 
      ? (((totalContractJobs - slaBreaches) / totalContractJobs) * 100).toFixed(1)
      : 100;

    const jobsByType = { Service: 0, Repair: 0, Installation: 0 };
    allJobs.filter(j => j.is_contract_job).forEach(j => {
        const type = j.job_type_name || "";
        if (type.includes("Service")) jobsByType.Service++;
        else if (type.includes("Install")) jobsByType.Installation++;
        else jobsByType.Repair++;
    });

    return { totalContractJobs, completedContractJobs, slaBreaches, slaCompliance, jobsByType };
  }, [allJobs]);

  // Data for new reports (filtered by DateRangeSelector)
  const reportProjects = useMemo(() => 
    filterRecordsByDateRange(allProjects, "created_date", reportDateRange), 
    [allProjects, reportDateRange]
  );

  const reportJobs = useMemo(() => 
    filterRecordsByDateRange(allJobs, "created_date", reportDateRange), 
    [allJobs, reportDateRange]
  );

  if (loading) {
    return (
      <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <RequirePermission roles={['admin']}>
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Business Reports</h1>
            <p className="text-sm text-[#4B5563] mt-1">
              Track performance and key metrics
            </p>
          </div>
          <DateRangeSelector value={reportDateRange} onChange={setReportDateRange} />
        </div>

        {/* Filters */}
        <Card className="mb-6 border border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  From Date
                </Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  To Date
                </Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Project Status</Label>
                <Tabs value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
                  <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                    <TabsTrigger value="Lead" className="flex-1">Lead</TabsTrigger>
                    <TabsTrigger value="Completed" className="flex-1">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] text-[#4B5563] font-medium">Total Projects</span>
                <TrendingUp className="w-5 h-5 text-[#FAE008]" />
              </div>
              <p className="text-[32px] font-bold text-[#111827]">{projectMetrics.total}</p>
              <p className="text-[12px] text-[#4B5563] mt-1">
                {projectMetrics.completed} completed
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] text-[#4B5563] font-medium">Completion Rate</span>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-[32px] font-bold text-[#111827]">{projectMetrics.completionRate}%</p>
              <p className="text-[12px] text-[#4B5563] mt-1">
                {projectMetrics.inProgress} in progress
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] text-[#4B5563] font-medium">Total Revenue</span>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-[32px] font-bold text-[#111827]">
                ${totalRevenue.toLocaleString()}
              </p>
              <p className="text-[12px] text-[#4B5563] mt-1">
                From quotes
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] text-[#4B5563] font-medium">Active Technicians</span>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-[32px] font-bold text-[#111827]">{technicianPerformance.length}</p>
              <p className="text-[12px] text-[#4B5563] mt-1">
                In period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Project Status Distribution */}
          <Card className="border border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[18px] font-semibold">Project Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {projectStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={projectStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {projectStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#4B5563] py-12">No data available</p>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Project Type */}
          <Card className="border border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[18px] font-semibold">Revenue by Project Type</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueByType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#FAE008" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#4B5563] py-12">No revenue data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Technician Performance */}
        <Card className="border border-[#E5E7EB] mb-6">
          <CardHeader>
            <CardTitle className="text-[18px] font-semibold">Technician Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {technicianPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left py-3 px-4 text-[14px] font-semibold text-[#111827]">Technician</th>
                      <th className="text-right py-3 px-4 text-[14px] font-semibold text-[#111827]">Jobs Completed</th>
                      <th className="text-right py-3 px-4 text-[14px] font-semibold text-[#111827]">Total Hours</th>
                      <th className="text-right py-3 px-4 text-[14px] font-semibold text-[#111827]">Avg Hours/Job</th>
                    </tr>
                  </thead>
                  <tbody>
                    {technicianPerformance.map((tech) => (
                      <tr key={tech.email} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                        <td className="py-3 px-4 text-[14px] text-[#111827]">{tech.name}</td>
                        <td className="py-3 px-4 text-[14px] text-[#111827] text-right font-medium">
                          {tech.jobsCompleted}
                        </td>
                        <td className="py-3 px-4 text-[14px] text-[#111827] text-right">
                          {tech.totalHours.toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-[14px] text-[#111827] text-right">
                          {tech.jobsCompleted > 0 
                            ? (tech.totalHours / tech.jobsCompleted).toFixed(1) 
                            : '0'}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-[#4B5563] py-8">No technician data available</p>
            )}
          </CardContent>
        </Card>

        {/* Contract Reports */}
        <Card className="border border-[#E5E7EB] mb-6 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-[18px] font-semibold text-purple-900">Contract Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-lg border border-purple-100">
                <div className="text-sm text-purple-600 mb-1">Active Contracts</div>
                <div className="text-2xl font-bold text-purple-900">{contracts.length}</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-purple-100">
                <div className="text-sm text-purple-600 mb-1">Total Contract Jobs</div>
                <div className="text-2xl font-bold text-purple-900">{contractMetrics.totalContractJobs}</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-purple-100">
                <div className="text-sm text-purple-600 mb-1">SLA Compliance</div>
                <div className="text-2xl font-bold text-purple-900">{contractMetrics.slaCompliance}%</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-purple-100">
                <div className="text-sm text-purple-600 mb-1">SLA Breaches</div>
                <div className="text-2xl font-bold text-red-600">{contractMetrics.slaBreaches}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="text-center p-2">
                 <div className="text-lg font-bold">{contractMetrics.jobsByType.Service}</div>
                 <div className="text-xs text-gray-500">Service Jobs</div>
               </div>
               <div className="text-center p-2">
                 <div className="text-lg font-bold">{contractMetrics.jobsByType.Repair}</div>
                 <div className="text-xs text-gray-500">Repair Jobs</div>
               </div>
               <div className="text-center p-2">
                 <div className="text-lg font-bold">{contractMetrics.jobsByType.Installation}</div>
                 <div className="text-xs text-gray-500">Install Jobs</div>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory & Parts Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory Status */}
          <Card className="border border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[18px] font-semibold">Inventory Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-[14px] font-medium text-[#111827]">In Stock</span>
                  </div>
                  <span className="text-[20px] font-bold text-green-600">{inventoryStatus.inStock}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="text-[14px] font-medium text-[#111827]">Low Stock</span>
                  </div>
                  <span className="text-[20px] font-bold text-yellow-600">{inventoryStatus.lowStock}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-red-600" />
                    <span className="text-[14px] font-medium text-[#111827]">Out of Stock</span>
                  </div>
                  <span className="text-[20px] font-bold text-red-600">{inventoryStatus.outOfStock}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parts Order Status */}
          <Card className="border border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[18px] font-semibold">Parts Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={partsOrderStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="status" type="category" width={100} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Operations Reports */}
        <div className="mt-6">
          <h2 className="text-[18px] font-semibold text-[#111827] mb-4">Operations</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProjectStageFunnelReport projects={reportProjects} />
            <JobStatusSummaryReport jobs={reportJobs} />
          </div>
        </div>
      </div>
    </div>
    </RequirePermission>
  );
}