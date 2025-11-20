import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Clock, Briefcase, Calendar, CheckCircle, MapPin } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const jobStatusColors = {
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
  const activeJobs = jobs.filter(j => (j.job_status === 'Scheduled' || j.status === 'scheduled') && !j.deleted_at);
  const completedToday = jobs.filter(j =>
    (j.job_status === 'Completed' || j.status === 'completed') &&
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
            <h1 className="text-3xl md:text-4xl font-bold text-[#111827] tracking-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-[#4B5563] mt-2.5 text-base">Here's what's happening today</p>
          </div>
          <Button
            onClick={() => window.location.href = '/Jobs?action=new'}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-md hover:shadow-lg transition-all duration-150 w-full md:w-auto h-12 rounded-lg"
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
                <p className="text-4xl font-bold text-[#111827]">{todayJobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-bold text-[#4B5563] uppercase tracking-wide mb-1.5">Today's Jobs</h3>
            <p className="text-xs text-[#6B7280] group-hover:text-[#111827] transition-colors font-medium">Click to view →</p>
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
                <p className="text-4xl font-bold text-[#111827]">{activeJobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-bold text-[#4B5563] uppercase tracking-wide mb-1.5">Active Jobs</h3>
            <p className="text-xs text-[#6B7280] group-hover:text-[#111827] transition-colors font-medium">Click to view →</p>
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
                <p className="text-4xl font-bold text-[#111827]">{completedToday.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-bold text-[#4B5563] uppercase tracking-wide mb-1.5">Completed Today</h3>
            <p className="text-xs text-[#6B7280] group-hover:text-[#111827] transition-colors font-medium">Click to view →</p>
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
                <p className="text-4xl font-bold text-[#111827]">{jobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-bold text-[#4B5563] uppercase tracking-wide mb-1.5">Total Jobs</h3>
            <p className="text-xs text-[#6B7280] group-hover:text-[#111827] transition-colors font-medium">Click to view →</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-7">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
            <h2 className="text-xl font-bold text-[#111827] mb-6 tracking-tight">Today's Schedule</h2>
            {todayJobs.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                <p className="text-[#4B5563] text-sm font-medium">No jobs scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayJobs.map(job => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-5 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#FAE008] cursor-pointer transition-all duration-150 min-h-[72px]"
                    onClick={() => window.location.href = `/Jobs?id=${job.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="font-bold text-[#111827] text-sm">#{job.job_number}</span>
                        <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${jobStatusColors[job.job_status || job.status] || jobStatusColors["Open"]}`}>
                          {job.job_status || job.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#111827]">{job.customer_name}</p>
                      <p className="text-xs text-[#4B5563] mt-1 font-medium">{job.scheduled_time || 'No time set'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-7 shadow-sm">
            <h2 className="text-xl font-bold text-[#111827] mb-6 tracking-tight">Recent Check-ins</h2>
            {todayCheckIns.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
                <p className="text-[#4B5563] text-sm font-medium">No check-ins today</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayCheckIns.slice(0, 5).map(checkIn => (
                  <div key={checkIn.id} className="p-5 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors min-h-[72px]">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-bold text-[#111827] text-sm">{checkIn.technician_name}</span>
                      {checkIn.duration_hours && (
                        <span className="text-sm font-bold text-[#111827] bg-[#FAE008] px-3 py-1.5 rounded-lg">
                          {checkIn.duration_hours.toFixed(1)}h
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#4B5563] space-y-1.5 font-medium">
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