import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Card as ShadCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Clock, Briefcase, Calendar, CheckCircle, MapPin, AlertCircle, FileText, Navigation, Target, Timer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";



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
  const queryClient = useQueryClient();

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

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const todayJobs = jobs.filter(j => j.scheduled_date === today && !j.deleted_at).sort((a, b) => {
    if (!a.scheduled_time) return 1;
    if (!b.scheduled_time) return -1;
    return a.scheduled_time.localeCompare(b.scheduled_time);
  });
  
  // Filter jobs for current technician if they are a technician
  const myTodayJobs = isTechnician 
    ? todayJobs.filter(j => {
        const assignedEmails = Array.isArray(j.assigned_to) ? j.assigned_to : j.assigned_to ? [j.assigned_to] : [];
        return assignedEmails.includes(user?.email);
      })
    : todayJobs;

  // Find next job (first job that hasn't been checked in yet)
  const activeCheckIn = checkIns.find((c) => !c.check_out_time && c.technician_email === user?.email);
  const nextJob = myTodayJobs.find(j => {
    const hasCheckIn = checkIns.some(c => c.job_id === j.id && c.technician_email === user?.email);
    return !hasCheckIn;
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

  const checkInMutation = useMutation({
    mutationFn: async (job) => {
      return await base44.entities.CheckInOut.create({
        job_id: job.id,
        technician_email: user.email,
        technician_name: user.full_name,
        check_in_time: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

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

  const handleStartNavigation = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS 
      ? `maps://maps.apple.com/?q=${encodedAddress}`
      : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(url, '_blank');
  };

  const handleMarkAsArrived = (job) => {
    checkInMutation.mutate(job);
  };

  return (
    <div className="p-2 md:p-8 bg-[#F8F9FA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-[#111111] tracking-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-[#4F4F4F] mt-1 md:mt-2 text-sm md:text-base">Here's what's happening today</p>
          </div>
          {!isTechnician && (
            <Button
              onClick={() => window.location.href = '/Jobs?action=new'}
              className="bg-[#FAE008] hover:bg-[#e5d007] active:bg-[#d4c006] text-black font-semibold shadow-md hover:shadow-lg transition-all duration-150 w-full md:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Job
            </Button>
          )}
        </div>

        {/* Next Job Section for Technicians */}
        {isTechnician && nextJob && !activeCheckIn && (
          <Card className="border-2 border-black rounded-xl mb-6 overflow-hidden bg-gradient-to-br from-[#FAE008] to-[#e5d007] shadow-xl">
            <CardHeader className="bg-black border-b-2 border-black p-4 md:p-6">
              <CardTitle className="flex items-center gap-3 text-lg md:text-xl font-bold text-[#FAE008] tracking-tight">
                <Target className="w-6 h-6" />
                Next Job
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="space-y-3 md:space-y-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xl md:text-2xl font-bold text-[#111111]">#{nextJob.job_number}</span>
                    <Badge variant="outline" className={`status-${nextJob.status} capitalize text-xs`}>
                      {nextJob.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-base md:text-lg font-semibold text-[#111111] mb-1">{nextJob.customer_name}</p>
                  {nextJob.job_type_name && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold border-2 text-xs mb-2">
                      {nextJob.job_type_name}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  {nextJob.scheduled_time && (
                    <div className="flex items-center gap-2 text-[#4F4F4F]">
                      <Clock className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="font-semibold text-sm md:text-base">{nextJob.scheduled_time}</span>
                    </div>
                  )}
                  {nextJob.address && (
                    <div className="flex items-start gap-2 text-[#4F4F4F]">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm md:text-base">{nextJob.address}</span>
                    </div>
                  )}
                </div>

                {nextJob.notes && nextJob.notes !== "<p><br></p>" && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">Important Notes</div>
                        <div 
                          className="text-sm text-amber-800 line-clamp-3 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: nextJob.notes }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <Button
                    onClick={() => handleStartNavigation(nextJob.address)}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold w-full h-14 shadow-lg"
                  >
                    <Navigation className="w-5 h-5 mr-2" />
                    Navigate
                  </Button>
                  <Button
                    onClick={() => handleMarkAsArrived(nextJob)}
                    disabled={checkInMutation.isPending}
                    className="bg-black hover:bg-gray-900 text-[#FAE008] font-bold w-full h-14 shadow-lg"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                  </Button>
                </div>

                <Button
                  onClick={() => handleJobClick(nextJob.id)}
                  className="bg-white hover:bg-gray-50 text-black font-semibold border-2 border-black w-full h-12"
                >
                  View Full Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Overview */}
        {(isTechnician ? myTodayJobs : todayJobs).length > 0 && (
          <Card className="card-enhanced overflow-hidden mb-6 border-2 border-[#FAE008]">
            <CardHeader className="bg-[#FFFBE6] border-b-2 border-[#FAE008] p-4 md:p-6">
              <CardTitle className="flex items-center gap-3 text-lg md:text-xl font-bold text-[#111827] tracking-tight">
              <Calendar className="w-6 h-6 text-[#111827]" />
              Today's Overview
              <Badge className="bg-slate-50 text-slate-700 border-slate-200 rounded-lg px-2 py-1 font-semibold border-2 text-xs">
                {(isTechnician ? myTodayJobs : todayJobs).length} {(isTechnician ? myTodayJobs : todayJobs).length === 1 ? 'Job' : 'Jobs'}
              </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <div className="space-y-2 md:space-y-3">
                {(isTechnician ? myTodayJobs : todayJobs).map((job) => (
                  <Card
                    key={job.id}
                    className="card-enhanced card-interactive"
                    onClick={() => handleJobClick(job.id)}
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5 md:mb-2">
                            <span className="text-sm md:text-base font-bold text-[#111111]">#{job.job_number}</span>
                            <span className="text-xs md:text-sm text-[#4F4F4F]">{job.customer_name}</span>
                            {job.job_type_name && (
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold border-2 text-xs rounded-lg">
                                {job.job_type_name}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`status-${job.status} capitalize text-xs`}>
                              {job.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>

                          <div className="space-y-0.5 md:space-y-1 text-xs md:text-sm mb-1.5 md:mb-2">
                            {job.scheduled_time && (
                              <div className="flex items-center gap-1.5 md:gap-2 text-[hsl(25,8%,45%)]">
                                <Clock className="w-3 h-3 md:w-4 md:h-4" />
                                <span className="font-semibold">{job.scheduled_time}</span>
                              </div>
                            )}
                            {job.address && (
                              <div className="flex items-start gap-1.5 md:gap-2 text-[hsl(25,8%,45%)]">
                                <MapPin className="w-3 h-3 md:w-4 md:h-4 mt-0.5 flex-shrink-0" />
                                <span>{job.address}</span>
                              </div>
                            )}
                          </div>

                          {job.notes && job.notes !== "<p><br></p>" && (
                            <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-2 md:p-3 mt-1.5 md:mt-2">
                              <div className="flex items-start gap-1.5 md:gap-2">
                                <AlertCircle className="w-3 h-3 md:w-4 md:h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-[10px] md:text-xs font-semibold text-amber-900 uppercase tracking-wide mb-0.5 md:mb-1">Important Notes</div>
                                  <div 
                                    className="text-xs md:text-sm text-amber-800 line-clamp-3 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: job.notes }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {job.additional_info && job.additional_info !== "<p><br></p>" && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-2 md:p-3 mt-1.5 md:mt-2">
                              <div className="flex items-start gap-1.5 md:gap-2">
                                <FileText className="w-3 h-3 md:w-4 md:h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-[10px] md:text-xs font-semibold text-blue-900 uppercase tracking-wide mb-0.5 md:mb-1">Information</div>
                                  <div 
                                    className="text-xs md:text-sm text-blue-800 line-clamp-3 prose prose-sm max-w-none"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div
            onClick={() => handleCardClick('today')}
            className="card-enhanced card-interactive p-6"
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl md:text-3xl font-bold text-[hsl(25,10%,12%)]">{isTechnician ? myTodayJobs.length : todayJobs.length}</p>
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-0.5 md:mb-1">Today's Jobs</h3>
            <p className="text-[10px] md:text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view details →</p>
          </div>

          <div
            onClick={() => handleCardClick('active')}
            className="card-enhanced card-interactive p-6"
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#fae008]/20 rounded-xl flex items-center justify-center group-hover:bg-[#fae008]/30 transition-colors">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-black" />
              </div>
              <div className="text-right">
                <p className="text-2xl md:text-3xl font-bold text-[hsl(25,10%,12%)]">{activeJobs.length}</p>
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-0.5 md:mb-1">Active Jobs</h3>
            <p className="text-[10px] md:text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view details →</p>
          </div>

          <div
            onClick={() => handleCardClick('completed')}
            className="card-enhanced card-interactive p-6"
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl md:text-3xl font-bold text-[hsl(25,10%,12%)]">{completedToday.length}</p>
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-0.5 md:mb-1">Completed Today</h3>
            <p className="text-[10px] md:text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view details →</p>
          </div>

          <div
            onClick={() => navigate(createPageUrl("Jobs"))}
            className="card-enhanced card-interactive p-6"
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl md:text-3xl font-bold text-[hsl(25,10%,12%)]">{jobs.length}</p>
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-[hsl(25,8%,45%)] uppercase tracking-wide mb-0.5 md:mb-1">Total Jobs</h3>
            <p className="text-[10px] md:text-xs text-[hsl(25,8%,55%)] group-hover:text-[hsl(25,8%,35%)] transition-colors">Click to view all →</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-enhanced">
            <CardHeader className="border-b-2 border-[#E5E7EB] p-5">
              <CardTitle className="text-lg md:text-xl font-bold text-[#111827] tracking-tight">Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              {(isTechnician ? myTodayJobs : todayJobs).length === 0 ? (
                <div className="text-center py-8 md:py-12">
                  <Clock className="w-10 h-10 md:w-12 md:h-12 mx-auto text-[hsl(32,15%,88%)] mb-2 md:mb-3" />
                  <p className="text-[hsl(25,8%,45%)] text-xs md:text-sm">No jobs scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {(isTechnician ? myTodayJobs : todayJobs).map(job => (
                    <div
                      key={job.id}
                      className="p-3 md:p-4 rounded-xl border-2 border-[hsl(32,15%,88%)] hover:bg-[#FEF8C8] hover:border-[#fae008] cursor-pointer transition-all duration-150"
                      onClick={() => handleJobClick(job.id)}
                    >
                      <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                        <span className="font-bold text-[hsl(25,10%,12%)] text-xs md:text-sm">#{job.job_number}</span>
                        <Badge variant="outline" className={`status-${job.status} capitalize text-xs`}>
                          {statusLabels[job.status] || job.status}
                        </Badge>
                      </div>
                      <p className="text-xs md:text-sm font-semibold text-[hsl(25,10%,12%)] mb-0.5 md:mb-1">{job.customer_name}</p>
                      {job.scheduled_time && (
                        <p className="text-[10px] md:text-xs text-[hsl(25,8%,45%)] flex items-center gap-1">
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

          <Card className="card-enhanced">
            <CardHeader className="border-b-2 border-[#E5E7EB] p-5">
              <CardTitle className="text-lg md:text-xl font-bold text-[#111827] tracking-tight">Recent Check-ins</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              {todayCheckIns.length === 0 ? (
                <div className="text-center py-8 md:py-12">
                  <CheckCircle className="w-10 h-10 md:w-12 md:h-12 mx-auto text-[hsl(32,15%,88%)] mb-2 md:mb-3" />
                  <p className="text-[hsl(25,8%,45%)] text-xs md:text-sm">No check-ins today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayCheckIns.slice(0, 5).map(checkIn => (
                    <div key={checkIn.id} className="card-enhanced p-4 hover:bg-[#FFFEF0]">
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <span className="font-semibold text-[hsl(25,10%,12%)] text-xs md:text-sm">{checkIn.technician_name}</span>
                        {checkIn.duration_hours && (
                          <span className="text-xs md:text-sm font-bold text-[hsl(25,10%,12%)] bg-[#FEF8C8] px-2 py-0.5 md:py-1 rounded-lg">
                            {checkIn.duration_hours.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] md:text-xs text-[hsl(25,8%,45%)] space-y-0.5 md:space-y-1">
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