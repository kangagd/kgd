import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Clock, Briefcase, Calendar, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import JobCard from "../components/jobs/JobCard";

const statusColors = {
  "Open": "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]",
  "Scheduled": "bg-[#FAE008] text-[#111827] border-[#FAE008]",
  "Completed": "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20",
  "Cancelled": "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"
};

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

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkIns'],
    queryFn: () => base44.entities.CheckInOut.list('-created_date', 10),
  });

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const todayJobs = jobs.filter(j => j.scheduled_date === today && !j.deleted_at);
  const tomorrowJobs = jobs.filter(j => j.scheduled_date === tomorrow && !j.deleted_at);
  const activeJobs = jobs.filter(j => j.status === 'in_progress' && !j.deleted_at);
  const completedToday = jobs.filter(j =>
    j.status === 'completed' &&
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
    } else if (filterType === 'active') {
      url += `?status=in_progress`;
    } else if (filterType === 'completed') {
      url += `?status=completed&date=${today}`;
    }
    navigate(url);
  };

  return (
    <div className="p-5 md:p-10 bg-[#F8F9FA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-5">
          <div>
            <h1 className="text-[28px] font-bold text-[#111827] leading-[1.2]">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-[14px] text-[#4B5563] leading-[1.4] mt-2.5">Here's what's happening today</p>
          </div>
          <Button
            onClick={() => window.location.href = '/Jobs?action=new'}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-md hover:shadow-lg transition-all duration-150 w-full md:w-auto h-12 rounded-lg text-[14px] leading-[1.4]"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Job
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 mb-8 md:mb-10">
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
            onClick={() => handleCardClick('active')}
            className="bg-white rounded-xl border border-[#E5E7EB] p-7 cursor-pointer hover:shadow-xl hover:border-[#FAE008] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 bg-[#FAE008]/10 rounded-xl flex items-center justify-center group-hover:bg-[#FAE008]/20 transition-colors">
                <TrendingUp className="w-7 h-7 text-[#111827]" />
              </div>
              <div className="text-right">
                <p className="text-[28px] font-bold text-[#111827] leading-[1.2]">{activeJobs.length}</p>
              </div>
            </div>
            <h3 className="text-[14px] font-semibold text-[#4B5563] leading-[1.4] uppercase tracking-wide mb-1.5">Active Jobs</h3>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-7">
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
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
            <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2] mb-6">Recent Check-ins</h2>
            {todayCheckIns.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">No check-ins today</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayCheckIns.slice(0, 5).map(checkIn => (
                  <div key={checkIn.id} className="p-5 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors min-h-[72px]">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[16px] font-medium text-[#111827] leading-[1.4]">{checkIn.technician_name}</span>
                      {checkIn.duration_hours && (
                        <span className="text-[14px] font-semibold text-[#111827] leading-[1.4] bg-[#FAE008] px-3 py-1.5 rounded-lg">
                          {checkIn.duration_hours.toFixed(1)}h
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[#4B5563] leading-[1.35] space-y-1.5 font-normal">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Check-in:</span>
                        <span>{new Date(checkIn.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {checkIn.check_out_time && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Check-out:</span>
                          <span>{new Date(checkIn.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>
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