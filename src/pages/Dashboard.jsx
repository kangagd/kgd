import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200"
};

const statusLabels = {
  in_progress: "In Progress",
  new_quote: "New Quote",
  update_quote: "Update Quote",
  send_invoice: "Send Invoice",
  completed: "Completed",
  return_visit_required: "Return Visit Required"
};

const priorityColors = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700"
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
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-slate-500 mt-1">Here's what's happening today</p>
          </div>
          <Button
            onClick={() => window.location.href = '/Jobs?action=new'}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div 
            onClick={() => handleCardClick('today')}
            className="bg-white rounded-xl border border-slate-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Today's Jobs</h3>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">{todayJobs.length}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{todayJobs.length}</p>
            <p className="text-xs text-slate-500 mt-1">Click to view →</p>
          </div>

          <div 
            onClick={() => handleCardClick('active')}
            className="bg-white rounded-xl border border-slate-200 p-6 cursor-pointer hover:shadow-lg hover:border-orange-300 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Active Jobs</h3>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 font-bold text-lg">{activeJobs.length}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{activeJobs.length}</p>
            <p className="text-xs text-slate-500 mt-1">Click to view →</p>
          </div>

          <div 
            onClick={() => handleCardClick('completed')}
            className="bg-white rounded-xl border border-slate-200 p-6 cursor-pointer hover:shadow-lg hover:border-green-300 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Completed</h3>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 font-bold text-lg">{completedToday.length}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{completedToday.length}</p>
            <p className="text-xs text-slate-500 mt-1">Click to view →</p>
          </div>

          <div 
            onClick={() => navigate(createPageUrl("Jobs"))}
            className="bg-white rounded-xl border border-slate-200 p-6 cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Total Jobs</h3>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 font-bold text-lg">{jobs.length}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{jobs.length}</p>
            <p className="text-xs text-slate-500 mt-1">Click to view →</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Today's Schedule</h2>
            {todayJobs.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No jobs scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todayJobs.map(job => (
                  <div 
                    key={job.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/Jobs?id=${job.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">#{job.job_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[job.status]}`}>
                          {statusLabels[job.status] || job.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{job.customer_name}</p>
                      <p className="text-xs text-slate-500">{job.scheduled_time || 'No time set'}</p>
                    </div>
                    {job.priority && (
                      <span className={`text-xs px-2 py-1 rounded-lg ${priorityColors[job.priority]}`}>
                        {job.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Check-ins</h2>
            {todayCheckIns.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No check-ins today</p>
            ) : (
              <div className="space-y-3">
                {todayCheckIns.slice(0, 5).map(checkIn => (
                  <div key={checkIn.id} className="p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900">{checkIn.technician_name}</span>
                      {checkIn.duration_hours && (
                        <span className="text-sm text-slate-600">{checkIn.duration_hours.toFixed(1)}h</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      <div>Check-in: {new Date(checkIn.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      {checkIn.check_out_time && (
                        <div>Check-out: {new Date(checkIn.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
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