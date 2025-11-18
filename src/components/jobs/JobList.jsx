import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, LogIn, Phone, Mail, Navigation, Timer, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const statusColors = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  scheduled: "bg-teal-50 text-teal-700 border-teal-200",
  quoted: "bg-purple-50 text-purple-700 border-purple-200",
  invoiced: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200"
};

const productColors = {
  "Garage Door": "bg-[#FEF8C8] text-slate-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700"
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColors = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-indigo-500", "bg-red-500", "bg-teal-500",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
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
    mutationFn: async (job) => {
      const checkIn = await base44.entities.CheckInOut.create({
        job_id: job.id,
        technician_email: user.email,
        technician_name: user.full_name,
        check_in_time: new Date().toISOString(),
      });
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCheckIns'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const handleCheckIn = (e, job) => {
    e.stopPropagation();
    checkInMutation.mutate(job);
  };

  const hasActiveCheckIn = (jobId) => {
    return checkIns.some(c => c.job_id === jobId && !c.check_out_time && c.technician_email === user?.email);
  };

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse border-2 border-[hsl(32,15%,88%)] rounded-2xl">
            <CardContent className="p-4 md:p-6">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-2"></div>
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
      <Card className="p-12 text-center border-2 border-[hsl(32,15%,88%)] rounded-2xl">
        <Timer className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-900 mb-1">No jobs found</h3>
        <p className="text-sm text-slate-500">Try adjusting your filters</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <Card 
          key={job.id}
          className="border-2 border-[hsl(32,15%,88%)] hover:border-[#fae008] hover:shadow-lg transition-all cursor-pointer rounded-2xl"
          onClick={() => onSelectJob(job)}
        >
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h3 className="text-lg font-bold text-[hsl(25,10%,12%)]">{job.customer_name}</h3>
                  <span className="text-sm text-[hsl(25,8%,45%)]">#{job.job_number}</span>
                  {job.product && (
                    <Badge className={`${productColors[job.product]} font-semibold border-2`}>
                      {job.product}
                    </Badge>
                  )}
                  {job.job_type_name && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold border-2">
                      {job.job_type_name}
                    </Badge>
                  )}
                  <Badge className={`${statusColors[job.status]} font-semibold border-2`}>
                    {job.status}
                  </Badge>
                </div>
                
                {job.address && (
                  <div className="flex items-start gap-2 text-[hsl(25,8%,45%)] mb-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{job.address}</span>
                  </div>
                )}

                {job.notes && job.notes !== "<p><br></p>" && (
                  <div 
                    className="text-sm text-[hsl(25,8%,45%)] line-clamp-2 prose prose-sm max-w-none mb-2"
                    dangerouslySetInnerHTML={{ __html: job.notes }}
                  />
                )}

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {job.scheduled_date && (
                    <div className="flex items-center gap-1.5 text-sm text-[hsl(25,8%,45%)]">
                      <Calendar className="w-4 h-4" />
                      {format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                      {job.scheduled_time && ` at ${job.scheduled_time}`}
                    </div>
                  )}
                  {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                      <span className="text-sm text-[hsl(25,8%,45%)]">
                        {Array.isArray(job.assigned_to_name) ? job.assigned_to_name.join(', ') : job.assigned_to_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-right text-sm text-[hsl(25,8%,45%)]">
                {job.created_date && (
                  <div className="text-xs">Created {new Date(job.created_date).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}