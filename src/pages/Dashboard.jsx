import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "../components/common/StatusBadge";
import { Plus, TrendingUp, Clock, Briefcase, Calendar, CheckCircle, FolderKanban } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import JobCard from "../components/jobs/JobCard";



export default function Dashboard() {
  const [user, setUser] = useState(null);
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

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const todayJobs = jobs.filter(j => j.scheduled_date === today && !j.deleted_at);
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
      url += `?date=${today}`;
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
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-sm text-[#4B5563] mt-1">Here's what's happening today</p>
          </div>
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
              variant="outline"
              className="border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#F9FAFB] text-[#111827] font-semibold shadow-sm hover:shadow-md transition h-10 px-4 text-sm rounded-xl"
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    onViewDetails={() => {}}
                  />
                ))}
              </div>
            )}
          </div>

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
        </div>
      </div>
    </div>
  );
}