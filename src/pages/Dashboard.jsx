import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "../components/common/StatusBadge";
import { Plus, Clock, Briefcase, Calendar, CheckCircle, FolderKanban, CheckSquare, Truck, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import JobCard from "../components/jobs/JobCard";
import XeroConnectButton from "../components/xero/XeroConnectButton";
import MaintenanceRemindersCard from "../components/dashboard/MaintenanceRemindersCard";
import EntityModal from "../components/common/EntityModal";
import JobModalView from "../components/jobs/JobModalView";



export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [modalJob, setModalJob] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const jobs = allJobs.filter(j => !j.deleted_at);

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkIns'],
    queryFn: () => base44.entities.CheckInOut.list('-created_date', 10),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['recentProjects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 5),
  });

  const recentProjects = allProjects.filter(p => !p.deleted_at).slice(0, 5);

  const { data: allTasks = [] } = useQuery({
    queryKey: ['myTasks', user?.email],
    queryFn: () => base44.entities.Task.filter({ assigned_to_email: user?.email }),
    enabled: !!user?.email,
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

  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ['recentPurchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-updated_date', 5),
    enabled: isAdminOrManager,
  });

  const recentPurchaseOrders = allPurchaseOrders.filter(po => po.status !== 'received').slice(0, 5);

  const logisticsJobs = jobs.filter(j => 
    j.job_type === 'Logistics' || 
    j.vehicle_id || 
    j.purchase_order_id ||
    j.third_party_trade_id
  ).slice(0, 5);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const todayJobs = jobs.filter(j => j.scheduled_date === today && !j.deleted_at && j.status !== 'Cancelled');
  const tomorrowJobs = jobs.filter(j => j.scheduled_date === tomorrow && !j.deleted_at);
  const upcomingJobs = jobs.filter(j => {
    const scheduledDate = j.scheduled_date;
    return scheduledDate && scheduledDate > today && !j.deleted_at && j.status !== 'Completed' && j.status !== 'Cancelled';
  }).slice(0, 5);
  const completedToday = jobs.filter(j =>
    j.status === 'Completed' &&
    j.updated_date?.split('T')[0] === today &&
    !j.deleted_at
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
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-sm text-[#4B5563] mt-1">Here's what's happening today</p>
          </div>
          {user?.role === 'admin' && <XeroConnectButton />}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
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

          <div
            onClick={() => navigate(createPageUrl("Jobs"))}
            className="bg-white rounded-xl border border-[#E5E7EB] p-7 cursor-pointer hover:shadow-xl hover:border-[#FAE008] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 bg-[#4B5563]/10 rounded-xl flex items-center justify-center group-hover:bg-[#4B5563]/20 transition-colors">
                <Briefcase className="w-7 h-7 text-[#4B5563]" />
              </div>
              <div className="text-right">
                <p className="text-[28px] font-bold text-[#111827] leading-[1.2]">{jobs.length}</p>
              </div>
            </div>
            <h3 className="text-[14px] font-semibold text-[#4B5563] leading-[1.4] uppercase tracking-wide mb-1.5">Total Jobs</h3>
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

        {isAdminOrManager && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Logistics Jobs */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Logistics Jobs</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(createPageUrl("Logistics"))}
                  className="text-[#6B7280] hover:text-[#111827] text-sm"
                >
                  View All →
                </Button>
              </div>
              {logisticsJobs.length === 0 ? (
                <div className="text-center py-16">
                  <Truck className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                  <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">No logistics jobs</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logisticsJobs.map(job => (
                    <div 
                      key={job.id} 
                      className="p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#FAE008] transition-all cursor-pointer"
                      onClick={() => navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-[#FAE008]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Truck className="w-4 h-4 text-[#111827]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-medium text-[#111827] leading-[1.4]">
                            #{job.job_number} {job.job_type_name || 'Logistics'}
                          </h4>
                          <p className="text-[12px] text-[#6B7280] leading-[1.35] truncate">{job.notes || job.address_full}</p>
                          {job.scheduled_date && (
                            <p className="text-[12px] text-[#6B7280] leading-[1.35] mt-1">
                              {format(parseISO(job.scheduled_date), 'MMM d')}
                              {job.scheduled_time && ` • ${job.scheduled_time}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Purchase Order Updates */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Purchase Orders</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(createPageUrl("Suppliers"))}
                  className="text-[#6B7280] hover:text-[#111827] text-sm"
                >
                  View All →
                </Button>
              </div>
              {recentPurchaseOrders.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                  <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">No active purchase orders</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPurchaseOrders.map(po => {
                    const statusColors = {
                      draft: 'bg-gray-100 text-gray-700 border-gray-200',
                      sent: 'bg-blue-50 text-blue-700 border-blue-200',
                      partially_received: 'bg-orange-50 text-orange-700 border-orange-200',
                      received: 'bg-green-50 text-green-700 border-green-200'
                    };
                    return (
                      <div 
                        key={po.id} 
                        className="p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#FAE008] transition-all cursor-pointer"
                        onClick={() => navigate(createPageUrl("Suppliers"))}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-[14px] font-medium text-[#111827] leading-[1.4]">
                              {po.po_number || 'Draft PO'}
                            </h4>
                            <p className="text-[12px] text-[#6B7280] leading-[1.35]">{po.supplier_name}</p>
                          </div>
                          <Badge variant="outline" className={`capitalize text-[10px] px-1.5 py-0 ${statusColors[po.status]}`}>
                            {po.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
                          <span>${po.total_amount_ex_tax?.toFixed(2) || '0.00'}</span>
                          {po.expected_date && (
                            <span>ETA: {format(parseISO(po.expected_date), 'MMM d')}</span>
                          )}
                        </div>
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