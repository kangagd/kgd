
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Clock, Briefcase, Calendar, CheckCircle, MapPin, AlertCircle, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  open: "rgba(37, 99, 235, 0.15)",
  scheduled: "rgba(14, 165, 233, 0.15)",
  in_progress: "rgba(14, 165, 233, 0.15)",
  quoted: "rgba(124, 58, 237, 0.15)",
  invoiced: "rgba(249, 115, 22, 0.15)",
  paid: "rgba(22, 163, 74, 0.15)",
  completed: "rgba(21, 128, 61, 0.15)",
  cancelled: "rgba(220, 38, 38, 0.15)"
};

const statusTextColors = {
  open: "#2563EB",
  scheduled: "#0EA5E9",
  in_progress: "#0EA5E9",
  quoted: "#7C3AED",
  invoiced: "#F97316",
  paid: "#16A34A",
  completed: "#15803D",
  cancelled: "#DC2626"
};

const statusLabels = {
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  quoted: "Quoted",
  invoiced: "Invoiced",
  paid: "Paid",
  completed: "Completed",
  lost: "Lost"
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

  const todayJobs = jobs.filter(j => j.scheduled_date === today && !j.deleted_at).sort((a, b) => {
    if (!a.scheduled_time) return 1;
    if (!b.scheduled_time) return -1;
    return a.scheduled_time.localeCompare(b.scheduled_time);
  });
  
  const tomorrowJobs = jobs.filter(j => j.scheduled_date === tomorrow && !j.deleted_at);
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

  const handleJobClick = (jobId) => {
    navigate(createPageUrl("Jobs") + `?jobId=${jobId}`);
  };

  return (
    <div className="p-4 md:p-8 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#111111] tracking-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-[#4F4F4F] mt-2 text-base">Here's what's happening today</p>
          </div>
          <Button
            onClick={() => window.location.href = '/Jobs?action=new'}
            className="bg-[#FAE008] hover:bg-[#e5d007] active:bg-[#d4c006] text-black font-semibold shadow-md hover:shadow-lg transition-all duration-150 w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Job
          </Button>
        </div>

        {/* Daily Overview */}
        {todayJobs.length > 0 && (
          <Card className="border-2 border-[#E2E3E5] rounded-2xl mb-6 overflow-hidden">
            <CardHeader className="bg-[#FEF8C8] border-b-2 border-[#E2E3E5] p-4 md:p-6">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-[#111111] tracking-tight">
                <Calendar className="w-6 h-6 text-[#111111]" />
                Today's Overview
                <Badge className="bg-[#FAE008] text-black font-semibold border-2 border-black">
                  {todayJobs.length} {todayJobs.length === 1 ? 'Job' : 'Jobs'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="space-y-3">
                {todayJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="border-2 border-[#E2E3E5] hover:border-[#FAE008] hover:shadow-lg transition-all cursor-pointer rounded-xl"
                    onClick={() => handleJobClick(job.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-base font-bold text-[#111111]">#{job.job_number}</span>
                            <span className="text-sm text-[#4F4F4F]">{job.customer_name}</span>
                            {job.job_type_name && (
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold border-2">
                                {job.job_type_name}
                              </Badge>
                            )}
                            <Badge style={{ backgroundColor: statusColors[job.status], color: statusTextColors[job.status] }} className={`capitalize font-semibold text-xs py-1 px-3 rounded-full border border-current`}>
                              {job.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-sm mb-2">
                            {job.scheduled_time && (
                              <div className="flex items-center gap-2 text-[hsl(25,8%,45%)]">
                                <Clock className="w-4 h-4" />
                                <span className="font-semibold">{job.scheduled_time}</span>
                              </div>
                            )}
                            {job.address && (
                              <div className="flex items-start gap-2 text-[hsl(25,8%,45%)]">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{job.address}</span>
                              </div>
                            )}
                          </div>

                          {job.notes && job.notes !== "<p><br></p>" && (
                            <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-3 mt-2">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">Important Notes</div>
                                  <div 
                                    className="text-sm text-amber-800 line-clamp-3 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: job.notes }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {job.additional_info && job.additional_info !== "<p><br></p>" && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-3 mt-2">
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">Information</div>
                                  <div 
                                    className="text-sm text-blue-800 line-clamp-3 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: job.additional_info }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
          <div
            onClick={() => handleCardClick('today')}
            className="bg-white rounded-2xl border-2 border-[hsl(32,15%,88%)] p-6 cursor-pointer hover:shadow-xl hover:border-[#fae008] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[hsl(25,10%,12%)]">{todayJobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-1">Today's Jobs</h3>
            <p className="text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view details →</p>
          </div>

          <div
            onClick={() => handleCardClick('active')}
            className="bg-white rounded-2xl border-2 border-[hsl(32,15%,88%)] p-6 cursor-pointer hover:shadow-xl hover:border-[#fae008] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-[#fae008]/20 rounded-xl flex items-center justify-center group-hover:bg-[#fae008]/30 transition-colors">
                <TrendingUp className="w-6 h-6 text-black" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[hsl(25,10%,12%)]">{activeJobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-1">Active Jobs</h3>
            <p className="text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view details →</p>
          </div>

          <div
            onClick={() => handleCardClick('completed')}
            className="bg-white rounded-2xl border-2 border-[hsl(32,15%,88%)] p-6 cursor-pointer hover:shadow-xl hover:border-green-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[hsl(25,10%,12%)]">{completedToday.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-1">Completed Today</h3>
            <p className="text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view details →</p>
          </div>

          <div
            onClick={() => navigate(createPageUrl("Jobs"))}
            className="bg-white rounded-2xl border-2 border-[hsl(32,15%,88%)] p-6 cursor-pointer hover:shadow-xl hover:border-purple-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <Briefcase className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[hsl(25,10%,12%)]">{jobs.length}</p>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-1">Total Jobs</h3>
            <p className="text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view all →</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          <Card className="border-2 border-[hsl(32,15%,88%)] rounded-2xl">
            <CardHeader className="border-b-2 border-[hsl(32,15%,88%)] p-4 md:p-6">
              <CardTitle className="text-xl font-bold text-[hsl(25,10%,12%)] tracking-tight">Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {todayJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-[hsl(32,15%,88%)] mb-3" />
                  <p className="text-[hsl(25,8%,45%)] text-sm">No jobs scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayJobs.map(job => (
                    <div
                      key={job.id}
                      className="p-4 rounded-xl border-2 border-[hsl(32,15%,88%)] hover:bg-[#FEF8C8] hover:border-[#fae008] cursor-pointer transition-all duration-150"
                      onClick={() => handleJobClick(job.id)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-[hsl(25,10%,12%)] text-sm">#{job.job_number}</span>
                        <Badge
                          style={{
                            backgroundColor: statusColors[job.status] || "rgba(200, 200, 200, 0.15)",
                            color: statusTextColors[job.status] || "#666",
                            borderColor: statusColors[job.status] ? `rgba(${statusColors[job.status].match(/\d+/g).slice(0,3).join(',')}, 0.5)` : "#ccc"
                          }}
                          className="font-semibold border-2 text-xs"
                        >
                          {statusLabels[job.status] || job.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-[hsl(25,10%,12%)] mb-1">{job.customer_name}</p>
                      {job.scheduled_time && (
                        <p className="text-xs text-[hsl(25,8%,45%)] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.scheduled_time}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-[hsl(32,15%,88%)] rounded-2xl">
            <CardHeader className="border-b-2 border-[hsl(32,15%,88%)] p-4 md:p-6">
              <CardTitle className="text-xl font-bold text-[hsl(25,10%,12%)] tracking-tight">Recent Check-ins</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {todayCheckIns.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-[hsl(32,15%,88%)] mb-3" />
                  <p className="text-[hsl(25,8%,45%)] text-sm">No check-ins today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayCheckIns.slice(0, 5).map(checkIn => (
                    <div key={checkIn.id} className="p-4 rounded-xl border-2 border-[hsl(32,15%,88%)] hover:bg-[#FEF8C8] transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-[hsl(25,10%,12%)] text-sm">{checkIn.technician_name}</span>
                        {checkIn.duration_hours && (
                          <span className="text-sm font-bold text-[hsl(25,10%,12%)] bg-[#FEF8C8] px-2.5 py-1 rounded-lg">
                            {checkIn.duration_hours.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[hsl(25,8%,45%)] space-y-1">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
