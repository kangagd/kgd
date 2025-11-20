import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, LogIn, Phone, Mail, Navigation, ChevronRight, Timer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unescape } from "lodash";

const statusColors = {
  "Open": "bg-slate-100 text-slate-800",
  "Scheduled": "bg-[#FAE008] text-[#111827]",
  "Completed": "bg-emerald-100 text-emerald-800",
  "Cancelled": "bg-red-100 text-red-800"
};

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700"
};

const getInitials = (name) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const avatarColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-red-500",
  "bg-teal-500",
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
      
      // Don't change status - let the date rule determine it
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

  const handleCall = (e, phone) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const handleDirections = (e, address) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const hasActiveCheckIn = (jobId) => {
    return checkIns.some(c => c.job_id === jobId && !c.check_out_time && c.technician_email === user?.email);
  };

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse rounded-2xl">
            <CardContent className="p-6">
              <div className="h-6 bg-[hsl(32,15%,88%)] rounded-lg w-1/3 mb-4"></div>
              <div className="h-4 bg-[hsl(32,15%,88%)] rounded-lg w-2/3 mb-2"></div>
              <div className="h-4 bg-[hsl(32,15%,88%)] rounded-lg w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="p-12 text-center rounded-2xl border-2 border-[hsl(32,15%,88%)]">
        <Timer className="w-16 h-16 mx-auto text-[hsl(32,15%,88%)] mb-4" />
        <h3 className="text-lg font-bold text-[hsl(25,10%,12%)] mb-2">No jobs found</h3>
        <p className="text-[hsl(25,8%,45%)]">Try adjusting your filters</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <Card 
          key={job.id}
          className="relative hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.005] active:scale-[0.995] group rounded-lg bg-white border border-[#E5E7EB] overflow-hidden"
          onClick={() => onSelectJob(job)}
        >
          {/* Yellow accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FAE008]" />

          <CardContent className="p-4 md:p-5 pl-6 md:pl-7">
            {/* Top row: identity + status */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl md:text-2xl font-bold text-[#111827] mb-2 group-hover:text-[#FAE008] transition-colors">
                  {job.customer_name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-[#F3F4F6] text-[#6B7280] hover:bg-[#F3F4F6] border-0 font-medium text-xs px-2.5 py-1 rounded-md">
                    #{job.job_number}
                  </Badge>
                  {job.project_name && (
                    <Badge className="bg-[#FEF9C3] text-[#854D0E] hover:bg-[#FEF9C3] border-0 font-medium text-xs px-2.5 py-1 rounded-md">
                      Project: {job.project_name}
                    </Badge>
                  )}
                </div>
              </div>
              
              <Badge className={`${statusColors[job.status]} font-semibold text-sm px-3 py-1.5 rounded-lg flex-shrink-0`}>
                {job.status}
              </Badge>
            </div>

            {/* Second row: address + actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <MapPin className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[#4B5563] leading-snug">{job.address}</span>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {job.customer_phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleCall(e, job.customer_phone)}
                    className="h-9 px-3 gap-1.5 border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all"
                    title="Call"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Call</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => handleDirections(e, job.address)}
                  className="h-9 px-3 gap-1.5 border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all"
                  title="Navigate"
                >
                  <Navigation className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">Navigate</span>
                </Button>
                {job.customer_email && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `mailto:${job.customer_email}`;
                    }}
                    className="h-9 px-3 gap-1.5 border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all"
                    title="Email"
                  >
                    <Mail className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Email</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Third row: when + what (light grey band) */}
            <div className="bg-[#F9FAFB] rounded-lg px-4 py-3 mb-3 border border-[#E5E7EB]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {job.scheduled_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm font-medium text-[#111827]">
                      {format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                
                {job.scheduled_time && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm font-medium text-[#111827]">{job.scheduled_time}</span>
                  </div>
                )}

                {job.product && (
                  <Badge className={`${productColors[job.product]} font-medium text-xs px-2.5 py-1 rounded-md border-0`}>
                    {job.product}
                  </Badge>
                )}
                
                {job.job_type_name && (
                  <Badge className="bg-[#EDE9FE] text-[#6D28D9] font-medium text-xs px-2.5 py-1 rounded-md border-0">
                    {job.job_type_name}
                  </Badge>
                )}
              </div>
            </div>

            {/* Notes band */}
            {job.notes && (
              <div className="bg-[#FEFCE8] border border-[#FDE047] rounded-lg px-4 py-3 flex gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#854D0E] leading-relaxed line-clamp-2">
                    <div dangerouslySetInnerHTML={{ __html: unescape(job.notes) }} />
                  </div>
                </div>
              </div>
            )}

            {/* Check-in button for technicians */}
            {isTechnician && job.status === 'Scheduled' && job.assigned_to?.includes(user?.email) && !hasActiveCheckIn(job.id) && (
              <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                <Button
                  size="sm"
                  onClick={(e) => handleCheckIn(e, job)}
                  disabled={checkInMutation.isPending}
                  className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] h-10 font-semibold transition-all"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Check In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}