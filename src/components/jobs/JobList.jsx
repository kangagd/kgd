import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, User, Briefcase, FileText, LogIn, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const statusColors = {
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200",
  scheduled: "bg-slate-100 text-slate-800 border-slate-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200"
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

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700",
};

export default function JobList({ jobs, isLoading, onSelectJob }) {
  const [user, setUser] = useState(null);
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

  const { data: checkIns = [] } = useQuery({
    queryKey: ['allCheckIns'],
    queryFn: () => base44.entities.CheckInOut.filter({}),
  });

  const checkInMutation = useMutation({
    mutationFn: async (jobId) => {
      const checkIn = await base44.entities.CheckInOut.create({
        job_id: jobId,
        technician_email: user.email,
        technician_name: user.full_name,
        check_in_time: new Date().toISOString(),
      });
      await base44.entities.Job.update(jobId, { status: 'in_progress' });
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCheckIns'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const handleCheckIn = (e, jobId) => {
    e.stopPropagation();
    checkInMutation.mutate(jobId);
  };

  const hasActiveCheckIn = (jobId) => {
    return checkIns.some(c => c.job_id === jobId && !c.check_out_time && c.technician_email === user?.email);
  };

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Briefcase className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No jobs found</h3>
        <p className="text-slate-500">Try adjusting your filters</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <Card 
          key={job.id}
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onSelectJob(job)}
        >
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-slate-900">{job.customer_name}</h3>
                <p className="text-sm text-slate-500 mb-1">Job #{job.job_number}</p>
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{job.address}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end items-start">
                <Badge className={statusColors[job.status]}>
                  {statusLabels[job.status] || job.status}
                </Badge>
                {isTechnician && job.status === 'scheduled' && job.assigned_to?.includes(user?.email) && !hasActiveCheckIn(job.id) && (
                  <Button
                    size="sm"
                    onClick={(e) => handleCheckIn(e, job.id)}
                    disabled={checkInMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    Check In
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">
                    {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {job.scheduled_time && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{job.scheduled_time}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                  Array.isArray(job.assigned_to_name) ? (
                    job.assigned_to_name.map((name, idx) => (
                      <Badge key={idx} variant="outline" className="text-slate-700">
                        <User className="w-3 h-3 mr-1" />
                        {name}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-slate-700">
                      <User className="w-3 h-3 mr-1" />
                      {job.assigned_to_name}
                    </Badge>
                  )
                )}
                
                {job.product && (
                  <Badge variant="outline" className={productColors[job.product]}>
                    <Package className="w-3 h-3 mr-1" />
                    {job.product}
                  </Badge>
                )}
                
                {job.job_type_name && (
                  <Badge variant="outline" className="text-slate-700">
                    <Briefcase className="w-3 h-3 mr-1" />
                    {job.job_type_name}
                  </Badge>
                )}
              </div>

              {job.notes && (
                <div className="flex items-start gap-2 text-slate-600 pt-2">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm line-clamp-2">{job.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}