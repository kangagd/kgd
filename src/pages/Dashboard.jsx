import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "../components/common/StatusBadge";
import { getPoDisplayReference, getPoIdentity } from "@/components/domain/poDisplayHelpers";
import { getPoEta, getPoSupplierName, safeParseDate } from "@/components/domain/schemaAdapters";
import { getPoStatusColor } from "@/components/domain/purchaseOrderStatusConfig";
import { Plus, Clock, Briefcase, Calendar, CheckCircle, FolderKanban, CheckSquare, Truck, Package, FolderOpen, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import JobCard from "../components/jobs/JobCard";
import XeroConnectButton from "../components/xero/XeroConnectButton";
import MaintenanceRemindersCard from "../components/dashboard/MaintenanceRemindersCard";
import EntityModal from "../components/common/EntityModal";
import JobModalView from "../components/jobs/JobModalView";
import { toast } from "sonner";
import { jobKeys } from "../components/api/queryKeys";



export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [modalJob, setModalJob] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Redirect technicians to Schedule with My Schedule view
        if (currentUser?.is_field_technician && currentUser?.role !== 'admin' && currentUser?.extended_role !== 'manager') {
          navigate(createPageUrl("Schedule"));
        }
      } catch (error) {
        // Error loading user - handled silently
      }
    };
    loadUser();
  }, [navigate]);

  const { data: allJobs = [] } = useQuery({
    queryKey: jobKeys.all,
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  const jobs = allJobs.filter(j => !j.deleted_at);

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkIns'],
    queryFn: () => base44.entities.CheckInOut.list('-created_date', 10),
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 5),
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  const recentProjects = allProjects.filter(p => !p.deleted_at).slice(0, 5);

  const { data: allTasks = [] } = useQuery({
    queryKey: ['myTasks', user?.email],
    queryFn: () => base44.entities.Task.filter({ assigned_to_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  const myTasks = allTasks
    .filter(t => t.status !== 'Completed' && t.status !== 'Cancelled')
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    })
    .slice(0, 5);

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  // Fetch unconfirmed jobs (scheduled in the next 7 days)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const { data: unconfirmedJobs = [] } = useQuery({
    queryKey: ['jobs', 'unconfirmed', 'dashboard'],
    queryFn: async () => {
      const jobs = await base44.entities.Job.filter({ 
        client_confirmed: false,
        status: 'Scheduled'
      });
      // Filter for jobs scheduled in the next 7 days, excluding logistics jobs
      return jobs.filter(job => {
        if (!job.scheduled_date || job.is_logistics_job) return false;
        const scheduledDate = new Date(job.scheduled_date);
        return scheduledDate >= new Date() && scheduledDate <= sevenDaysFromNow;
      });
    },
    enabled: isAdminOrManager,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  // Fetch unbooked third party trades
  const { data: unbookedTrades = [] } = useQuery({
    queryKey: ['trades', 'unbooked', 'dashboard'],
    queryFn: () => base44.entities.ProjectTradeRequirement.filter({ 
      status: 'Required'
    }),
    enabled: isAdminOrManager,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  // Combine both into attention items
  const criticalAttentionItems = [
    ...unconfirmedJobs.map(job => ({
      id: `job-${job.id}`,
      type: 'unconfirmed_job',
      title: `Client not confirmed - ${job.customer_name || 'Job'}`,
      description: job.scheduled_date ? `Scheduled: ${format(new Date(job.scheduled_date), 'MMM d, yyyy')}` : null,
      entity_type: 'job',
      entity_id: job.id,
      job_number: job.job_number,
      created_date: job.created_date
    })),
    ...unbookedTrades.map(trade => ({
      id: `trade-${trade.id}`,
      type: 'unbooked_trade',
      title: `Third party trade not booked - ${trade.trade_type || 'Trade'}`,
      description: trade.notes || trade.project_title,
      entity_type: 'project',
      entity_id: trade.project_id,
      project_title: trade.project_title,
      created_date: trade.created_date
    }))
  ]
  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
  .slice(0, 5);

  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-updated_date', 5),
    enabled: isAdminOrManager,
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  const recentPurchaseOrders = allPurchaseOrders.filter(po => 
    po.status !== 'received' && 
    po.status !== 'installed' &&
    po.status !== 'cancelled' &&
    po.status !== 'in_storage'
  ).slice(0, 5);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
    enabled: isAdminOrManager && recentPurchaseOrders.length > 0,
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });



  // Get today's date in local timezone (YYYY-MM-DD format)
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getLocalDateString(new Date());
  const tomorrow = getLocalDateString(new Date(Date.now() + 86400000));

  const todayJobs = jobs.filter(j => {
    if (j.scheduled_date !== today || j.deleted_at || j.status === 'Cancelled') {
      return false;
    }
    // Filter for field technician - only their assigned jobs
    if (user?.is_field_technician && user?.role !== 'admin' && user?.role !== 'manager') {
      return j.assigned_to?.includes(user.email);
    }
    return true;
  });
  const tomorrowJobs = jobs.filter(j => j.scheduled_date === tomorrow && !j.deleted_at);
  const upcomingJobs = jobs.filter(j => {
    const scheduledDate = j.scheduled_date;
    return scheduledDate && scheduledDate > today && !j.deleted_at && j.status !== 'Completed' && j.status !== 'Cancelled';
  }).slice(0, 5);
  // Get jobs completed today based on check-out time
  const completedTodayCheckOuts = checkIns.filter(c => {
    if (!c.check_out_time) return false;
    const checkOutDate = new Date(c.check_out_time);
    const localDateString = getLocalDateString(checkOutDate);
    return localDateString === today;
  });
  
  const completedTodayJobIds = new Set(completedTodayCheckOuts.map(c => c.job_id));
  const completedToday = jobs.filter(j => 
    completedTodayJobIds.has(j.id) && !j.deleted_at
  );

  const todayCheckIns = checkIns.filter(c =>
    c.created_date?.split('T')[0] === today
  );

  const totalHoursToday = todayCheckIns.reduce((sum, c) =>
    sum + (c.duration_hours || 0), 0
  );

  const handleCardClick = (filterType) => {
    let url = createPageUrl("Jobs");
    if (filterType === 'today') {
      url += `?dateFrom=${today}&dateTo=${today}`;
    } else if (filterType === 'upcoming') {
      url += `?status=Scheduled`;
    } else if (filterType === 'completed') {
      url += `?status=Completed&date=${today}`;
    }
    navigate(url);
  };

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.display_name || 'there'}!
            </h1>
            <p className="text-sm text-[#4B5563] mt-1">Here's what's happening today</p>
          </div>
          {user?.role === 'admin' && (
            <XeroConnectButton />
          )}
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <Button
              onClick={() => window.location.href = '/Jobs?action=new'}
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-sm hover:shadow-md transition h-10 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
            <Button
              onClick={() => navigate(createPageUrl("Projects") + '?action=new')}
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-sm hover:shadow-md transition h-10 px-4 text-sm rounded-xl"
            >
              <FolderKanban className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
          <div
            onClick={() => handleCardClick('today')}
            className="bg-white rounded-xl border border-[#E5E7EB] p-7 cursor-pointer hover:shadow-xl hover:border-[#FAE008] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 bg-[#FAE008]/10 rounded-xl flex items-center justify-center group-hover:bg-[#FAE008]/20 transition-colors">
                <Clock className="w-7 h-7 text-[#111827]" />
              </div>
              <div className="text-right">
                <p className="text-[28px] font-bold text-[#111827] leading-[1.2]">{todayJobs.length}</p>
              </div>
            </div>
            <h3 className="text-[14px] font-semibold text-[#4B5563] leading-[1.4] uppercase tracking-wide mb-1.5">Today's Jobs</h3>
            <p className="text-[12px] text-[#6B7280] leading-[1.35] group-hover:text-[#111827] transition-colors font-normal">Click to view →</p>
          </div>

          <div
            onClick={() => handleCardClick('upcoming')}
            className="bg-white rounded-xl border border-[#E5E7EB] p-7 cursor-pointer hover:shadow-xl hover:border-[#FAE008] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 bg-[#FAE008]/10 rounded-xl flex items-center justify-center group-hover:bg-[#FAE008]/20 transition-colors">
                <Calendar className="w-7 h-7 text-[#111827]" />
              </div>
              <div className="text-right">
                <p className="text-[28px] font-bold text-[#111827] leading-[1.2]">{upcomingJobs.length}</p>
              </div>
            </div>
            <h3 className="text-[14px] font-semibold text-[#4B5563] leading-[1.4] uppercase tracking-wide mb-1.5">Upcoming Jobs</h3>
            <p className="text-[12px] text-[#6B7280] leading-[1.35] group-hover:text-[#111827] transition-colors font-normal">Click to view →</p>
          </div>

          <div
            onClick={() => handleCardClick('completed')}
            className="bg-white rounded-xl border border-[#E5E7EB] p-7 cursor-pointer hover:shadow-xl hover:border-[#16A34A] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 bg-[#16A34A]/10 rounded-xl flex items-center justify-center group-hover:bg-[#16A34A]/20 transition-colors">
                <CheckCircle className="w-7 h-7 text-[#16A34A]" />
              </div>
              <div className="text-right">
                <p className="text-[28px] font-bold text-[#111827] leading-[1.2]">{completedToday.length}</p>
              </div>
            </div>
            <h3 className="text-[14px] font-semibold text-[#4B5563] leading-[1.4] uppercase tracking-wide mb-1.5">Completed Today</h3>
            <p className="text-[12px] text-[#6B7280] leading-[1.35] group-hover:text-[#111827] transition-colors font-normal">Click to view →</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">My Tasks</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl("Tasks"))}
                className="text-[#6B7280] hover:text-[#111827] text-sm"
              >
                View All →
              </Button>
            </div>
            {myTasks.length === 0 ? (
              <div className="text-center py-16">
                <CheckSquare className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">No tasks assigned to you</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTasks.map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed';
                  const isDueToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#FAE008] transition-all cursor-pointer"
                      onClick={() => navigate(createPageUrl("Tasks") + `?taskId=${task.id}`)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          task.priority === 'High' ? 'bg-red-500' : 
                          task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-medium text-[#111827] leading-[1.4] truncate">{task.title}</h4>
                          {task.due_date && (
                            <p className={`text-[12px] leading-[1.35] mt-1 ${
                              isOverdue ? 'text-red-600 font-medium' : 
                              isDueToday ? 'text-[#D97706] font-medium' : 'text-[#6B7280]'
                            }`}>
                              {isOverdue ? 'Overdue: ' : isDueToday ? 'Due today' : 'Due: '}
                              {!isDueToday && format(new Date(task.due_date), 'MMM d')}
                            </p>
                          )}
                          {task.project_name && (
                            <p className="text-[12px] text-[#6B7280] leading-[1.35] truncate">{task.project_name}</p>
                          )}
                        </div>
                        <Badge variant={task.status === 'In Progress' ? 'primary' : 'secondary'} className="text-[10px] flex-shrink-0">
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isAdminOrManager && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Attention Items</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(createPageUrl("Projects"))}
                  className="text-[#6B7280] hover:text-[#111827] text-sm"
                >
                  View All →
                </Button>
              </div>
              {criticalAttentionItems.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                  <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">All clear! No urgent items</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {criticalAttentionItems.map(item => {
                    const handleClick = () => {
                      if (item.entity_type === 'project' && item.entity_id) {
                        navigate(createPageUrl("Projects") + `?projectId=${item.entity_id}`);
                      } else if (item.entity_type === 'job' && item.entity_id) {
                        navigate(createPageUrl("Jobs") + `?jobId=${item.entity_id}`);
                      }
                    };

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#FEF3C7] hover:border-[#D97706] transition-all cursor-pointer"
                        onClick={handleClick}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-yellow-100">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[14px] font-medium text-[#111827] leading-[1.4]">
                              {item.title}
                            </h4>
                            {item.description && (
                              <p className="text-[12px] text-[#6B7280] leading-[1.35] mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            {item.entity_type === 'project' && (
                              <p className="text-[12px] text-[#6B7280] leading-[1.35] mt-1 truncate flex items-center gap-1">
                                <FolderKanban className="w-3 h-3" />
                                Project
                              </p>
                            )}
                            {item.entity_type === 'job' && item.job_number && (
                              <p className="text-[12px] text-[#6B7280] leading-[1.35] mt-1 truncate flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                Job #{item.job_number}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {user?.is_field_technician && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
              <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2] mb-6">Today's Schedule</h2>
              {todayJobs.length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                  <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">No jobs scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayJobs.map(job => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)}
                      onViewDetails={(job) => setModalJob(job)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!(user?.is_field_technician && user?.role !== 'admin') && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
              <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2] mb-6">Project Updates</h2>
              {recentProjects.length === 0 ? (
                <div className="text-center py-16">
                  <Briefcase className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                  <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">No recent project updates</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentProjects.map(project => (
                    <div 
                      key={project.id} 
                      className="p-5 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#FAE008] transition-all cursor-pointer"
                      onClick={() => navigate(createPageUrl("Projects") + `?projectId=${project.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-[16px] font-medium text-[#111827] leading-[1.4] mb-1">{project.title}</h4>
                          <p className="text-[14px] text-[#4B5563] leading-[1.4]">{project.customer_name}</p>
                        </div>
                        <ProjectStatusBadge value={project.status} className="ml-2" />
                      </div>
                      <p className="text-[12px] text-[#6B7280] leading-[1.35]">
                        Updated {format(parseISO(project.updated_date), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {isAdminOrManager && recentPurchaseOrders.length > 0 && (
          <div className="mb-6">
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Active Purchase Orders</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(createPageUrl("PurchaseOrders"))}
                  className="text-[#6B7280] hover:text-[#111827] text-sm"
                >
                  View All →
                </Button>
              </div>
              {(
                <div className="space-y-3">
                  {recentPurchaseOrders.map(po => {
                    const poIdentity = getPoIdentity(po);
                    const eta = getPoEta(po);
                    const etaDate = safeParseDate(eta);
                    const linkedProject = projects.find(p => p.id === po.project_id);
                    
                    return (
                      <div 
                        key={po.id} 
                        className="p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#FAE008] transition-all cursor-pointer"
                        onClick={() => navigate(`${createPageUrl("PurchaseOrders")}?poId=${po.id}`)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">
                                {poIdentity.reference}
                              </h4>
                              <Badge className={getPoStatusColor(po.status)}>
                                {po.status?.replace('_', ' ')}
                              </Badge>
                            </div>
                            {poIdentity.name && (
                              <p className="text-[12px] text-[#4B5563] leading-[1.35] mb-1">{poIdentity.name}</p>
                            )}
                            <div className="flex items-center gap-2 text-[12px] text-[#6B7280] leading-[1.35]">
                              <Package className="w-3 h-3" />
                              <span>{getPoSupplierName(po) || 'Unknown Supplier'}</span>
                            </div>
                            {linkedProject && (
                              <div className="flex items-center gap-2 text-[12px] text-[#6B7280] leading-[1.35] mt-1">
                                <FolderOpen className="w-3 h-3" />
                                <span>{linkedProject.title}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {etaDate && (
                          <div className="flex items-center text-[12px] text-[#6B7280] mt-2">
                            <Clock className="w-3 h-3 mr-1" />
                            <span>ETA: {format(etaDate, 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {user?.role === 'admin' && (
          <MaintenanceRemindersCard user={user} />
        )}
      </div>

      <EntityModal
        open={!!modalJob}
        onClose={() => setModalJob(null)}
        title={`Job #${modalJob?.job_number}`}
        onOpenFullPage={() => {
          setModalJob(null);
          navigate(createPageUrl("Jobs") + `?jobId=${modalJob.id}`);
        }}
        fullPageLabel="Open Full Job"
      >
        {modalJob && <JobModalView job={modalJob} />}
      </EntityModal>
    </div>
  );
}