import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Clock, CheckCircle2, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  in_progress: "bg-blue-50 text-blue-900 border-blue-200",
  new_quote: "bg-purple-50 text-purple-900 border-purple-200",
  update_quote: "bg-indigo-50 text-indigo-900 border-indigo-200",
  send_invoice: "bg-[#fae008]/20 text-[#000000] border-[#fae008]/40",
  completed: "bg-green-50 text-green-900 border-green-200",
  return_visit_required: "bg-amber-50 text-amber-900 border-amber-200",
  scheduled: "bg-slate-50 text-slate-900 border-slate-200",
  cancelled: "bg-slate-50 text-slate-900 border-slate-200"
};

const statusLabels = {
  in_progress: "In Progress",
  new_quote: "New Quote",
  update_quote: "Update Quote",
  send_invoice: "Send Invoice",
  completed: "Completed",
  return_visit_required: "Return Visit Required",
  scheduled: "Scheduled",
  cancelled: "Cancelled"
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

  const todayJobs = jobs.filter(j => j.scheduled_date === today);
  const tomorrowJobs = jobs.filter(j => j.scheduled_date === tomorrow);
  const activeJobs = jobs.filter(j => j.status === 'in_progress');
  const completedToday = jobs.filter(j => 
    j.status === 'completed' && 
    j.updated_date?.split('T')[0] === today
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
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#000000] tracking-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-slate-600 mt-2 text-base">Here's what's happening today</p>
          </div>
          <Button
            onClick={() => window.location.href = '/Jobs?action=new'}
            className="bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-semibold shadow-md hover:shadow-lg transition-all duration-150 w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Job
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
          <div 
            onClick={() => handleCardClick('today')}
            className="bg-white rounded-2xl border-2 border-slate-200 p-6 cursor-pointer hover:shadow-xl hover:border-blue-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[#000000]">{todayJobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">Today's Jobs</h3>
            <p className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">Click to view details →</p>
          </div>

          <div 
            onClick={() => handleCardClick('active')}
            className="bg-white rounded-2xl border-2 border-slate-200 p-6 cursor-pointer hover:shadow-xl hover:border-[#fae008] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-[#fae008]/20 rounded-xl flex items-center justify-center group-hover:bg-[#fae008]/30 transition-colors">
                <TrendingUp className="w-6 h-6 text-[#000000]" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[#000000]">{activeJobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">Active Jobs</h3>
            <p className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">Click to view details →</p>
          </div>

          <div 
            onClick={() => handleCardClick('completed')}
            className="bg-white rounded-2xl border-2 border-slate-200 p-6 cursor-pointer hover:shadow-xl hover:border-green-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[#000000]">{completedToday.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">Completed Today</h3>
            <p className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">Click to view details →</p>
          </div>

          <div 
            onClick={() => navigate(createPageUrl("Jobs"))}
            className="bg-white rounded-2xl border-2 border-slate-200 p-6 cursor-pointer hover:shadow-xl hover:border-purple-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Briefcase className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[#000000]">{jobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">Total Jobs</h3>
            <p className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">Click to view all →</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#000000] mb-5 tracking-tight">Today's Schedule</h2>
            {todayJobs.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No jobs scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayJobs.map(job => (
                  <div 
                    key={job.id} 
                    className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all duration-150"
                    onClick={() => window.location.href = `/Jobs?id=${job.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-[#000000] text-sm">#{job.job_number}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColors[job.status]}`}>
                          {statusLabels[job.status] || job.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#000000]">{job.customer_name}</p>
                      <p className="text-xs text-slate-600 mt-1">{job.scheduled_time || 'No time set'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#000000] mb-5 tracking-tight">Recent Check-ins</h2>
            {todayCheckIns.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No check-ins today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayCheckIns.slice(0, 5).map(checkIn => (
                  <div key={checkIn.id} className="p-4 rounded-xl border-2 border-slate-200 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#000000] text-sm">{checkIn.technician_name}</span>
                      {checkIn.duration_hours && (
                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {checkIn.duration_hours.toFixed(1)}h
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Check-in:</span>
                        <span>{new Date(checkIn.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {checkIn.check_out_time && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Check-out:</span>
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