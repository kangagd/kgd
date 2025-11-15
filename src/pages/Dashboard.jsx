import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle, AlertCircle, Plus, TrendingUp } from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const [user, setUser] = useState(null);

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

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkIns'],
    queryFn: () => base44.entities.CheckInOut.list('-created_date'),
  });

  const todayJobs = jobs.filter(job => {
    try {
      return job.scheduled_date && isToday(parseISO(job.scheduled_date));
    } catch {
      return false;
    }
  });

  const tomorrowJobs = jobs.filter(job => {
    try {
      return job.scheduled_date && isTomorrow(parseISO(job.scheduled_date));
    } catch {
      return false;
    }
  });

  const activeJobs = jobs.filter(job => job.status === 'in_progress');
  const completedToday = jobs.filter(job => {
    try {
      return job.status === 'completed' && 
             job.updated_date && 
             isToday(parseISO(job.updated_date));
    } catch {
      return false;
    }
  });

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Good {new Date().getHours() < 12 ? 'Morning' : 'Afternoon'}
              {user ? `, ${user.full_name?.split(' ')[0]}` : ''}
            </h1>
            <p className="text-slate-500 mt-1">Here's what's happening today</p>
          </div>
          <Link to={createPageUrl("Jobs") + "?action=new"}>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-500">Today's Jobs</CardTitle>
                <Calendar className="w-4 h-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{todayJobs.length}</div>
              <p className="text-xs text-slate-500 mt-2">{tomorrowJobs.length} scheduled tomorrow</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-500">In Progress</CardTitle>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{activeJobs.length}</div>
              <p className="text-xs text-slate-500 mt-2">Active jobs right now</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-500">Completed</CardTitle>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{completedToday.length}</div>
              <p className="text-xs text-slate-500 mt-2">Finished today</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-500">Total Jobs</CardTitle>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{jobs.length}</div>
              <p className="text-xs text-slate-500 mt-2">All time</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-semibold">Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center text-slate-500">Loading...</div>
              ) : todayJobs.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No jobs scheduled for today</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {todayJobs.slice(0, 5).map((job) => (
                    <Link 
                      key={job.id} 
                      to={createPageUrl("Jobs") + `?id=${job.id}`}
                      className="block p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{job.customer_name}</h3>
                          <p className="text-sm text-slate-500 mt-1">{job.address}</p>
                        </div>
                        <Badge className={statusColors[job.status]}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.scheduled_time || 'Not set'}
                        </span>
                        {job.job_type_name && (
                          <Badge variant="outline" className="text-xs">
                            {job.job_type_name}
                          </Badge>
                        )}
                        {job.priority !== 'medium' && (
                          <Badge className={priorityColors[job.priority]}>
                            {job.priority}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-semibold">Recent Check-Ins</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {checkIns.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No check-ins yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {checkIns.slice(0, 5).map((checkIn) => (
                    <div key={checkIn.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{checkIn.technician_name}</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            {format(parseISO(checkIn.check_in_time), 'h:mm a')}
                            {checkIn.check_out_time && 
                              ` - ${format(parseISO(checkIn.check_out_time), 'h:mm a')}`
                            }
                          </p>
                        </div>
                        {checkIn.check_out_time ? (
                          <Badge className="bg-green-100 text-green-700">
                            Completed
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700">
                            On Site
                          </Badge>
                        )}
                      </div>
                      {checkIn.duration_hours && (
                        <p className="text-xs text-slate-500">
                          Duration: {checkIn.duration_hours.toFixed(1)} hours
                        </p>
                      )}
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