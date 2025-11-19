import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, LogIn, Phone, Mail, Navigation, Timer, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

const productColors = {
  "Garage Door": "bg-[#FEF8C8] text-slate-700 border-slate-200",
  "Gate": "bg-green-100 text-green-700 border-green-200",
  "Roller Shutter": "bg-purple-100 text-purple-700 border-purple-200",
  "Multiple": "bg-orange-100 text-orange-700 border-orange-200",
  "Custom Garage Door": "bg-pink-100 text-pink-700 border-pink-200"
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColors = [
"bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
"bg-pink-500", "bg-indigo-500", "bg-red-500", "bg-teal-500"];


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
    queryFn: () => base44.entities.CheckInOut.filter({})
  });

  const checkInMutation = useMutation({
    mutationFn: async (job) => {
      const checkIn = await base44.entities.CheckInOut.create({
        job_id: job.id,
        technician_email: user.email,
        technician_name: user.full_name,
        check_in_time: new Date().toISOString()
      });
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCheckIns'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const handleCheckIn = (e, job) => {
    e.stopPropagation();
    checkInMutation.mutate(job);
  };

  const hasActiveCheckIn = (jobId) => {
    return checkIns.some((c) => c.job_id === jobId && !c.check_out_time && c.technician_email === user?.email);
  };

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  if (isLoading) {
    return (
      <div className="space-y-3 md:space-y-4">
        {[1, 2, 3].map((i) =>
        <Card key={i} className="animate-pulse border-2 border-[hsl(32,15%,88%)] rounded-2xl">
            <CardContent className="p-3 md:p-6">
              <div className="h-4 md:h-5 bg-slate-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 md:h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
              <div className="h-3 md:h-4 bg-slate-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        )}
      </div>);

  }

  if (jobs.length === 0) {
    return (
      <Card className="p-8 md:p-12 text-center border-2 border-[hsl(32,15%,88%)] rounded-2xl">
        <Timer className="w-10 h-10 md:w-12 md:h-12 mx-auto text-slate-300 mb-2 md:mb-3" />
        <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-1">No jobs found</h3>
        <p className="text-xs md:text-sm text-slate-500">Try adjusting your filters</p>
      </Card>);

  }

  return (
    <div className="space-y-2 md:space-y-4">
      {jobs.map((job) =>
      <Card
        key={job.id}
        className="border-2 border-[#E2E3E5] hover:border-[#FAE008] hover:shadow-lg transition-all cursor-pointer rounded-2xl"
        onClick={() => onSelectJob(job)}>

          <CardContent className="p-3 md:p-6">
            <div className="flex items-start justify-between gap-3 md:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap mb-1.5 md:mb-2">
                  <h3 className="text-base md:text-lg font-bold text-[#111111]">{job.customer_name}</h3>
                  <span className="text-xs md:text-sm text-[#4F4F4F]">#{job.job_number}</span>
                  {job.product &&
                <Badge className={`${productColors[job.product]} font-semibold border-2 text-xs rounded-full py-1 px-2 md:px-3`}>
                      {job.product}
                    </Badge>
                }
                  {job.job_type_name &&
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold border-2 text-xs rounded-full py-1 px-2 md:px-3">
                      {job.job_type_name}
                    </Badge>
                }
                  <Badge className="status-chip capitalize">
                    {job.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                
                {job.address &&
              <div className="flex items-start gap-1.5 md:gap-2 text-[#4F4F4F] mb-1.5 md:mb-2">
                    <MapPin className="w-3 h-3 md:w-4 md:h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm">{job.address}</span>
                  </div>
              }

                {job.notes && job.notes !== "<p><br></p>" &&
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-2 mb-1.5 md:mb-2 text-xs md:text-sm prose prose-sm line-clamp-2 max-w-none"
              dangerouslySetInnerHTML={{ __html: job.notes }} />
              }

                <div className="flex items-center gap-2 md:gap-3 mt-1.5 md:mt-2 flex-wrap">
                  {job.scheduled_date &&
                <div className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm text-[#4F4F4F]">
                      <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                      {format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                      {job.scheduled_time && ` at ${job.scheduled_time}`}
                    </div>
                }
                  {job.assigned_to_name && job.assigned_to_name.length > 0 &&
                <div className="flex items-center gap-1 md:gap-1.5">
                      <User className="w-3 h-3 md:w-4 md:h-4 text-[#4F4F4F]" />
                      <span className="text-xs md:text-sm text-[#4F4F4F]">
                        {Array.isArray(job.assigned_to_name) ? job.assigned_to_name.join(', ') : job.assigned_to_name}
                      </span>
                    </div>
                }
                </div>
              </div>
              
              <div className="text-right text-xs md:text-sm text-[#4F4F4F] flex-shrink-0">
                {job.created_date &&
              <div className="text-[10px] md:text-xs">Created {new Date(job.created_date).toLocaleDateString()}</div>
              }
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>);

}