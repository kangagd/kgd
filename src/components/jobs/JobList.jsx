
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
  open: "bg-[hsl(32,25%,94%)] text-[hsl(25,10%,12%)] border-[hsl(32,15%,88%)]",
  scheduled: "bg-[#fae008]/20 text-[hsl(25,10%,12%)] border-[#fae008]/30",
  quoted: "bg-purple-100 text-purple-800 border-purple-200",
  invoiced: "bg-indigo-100 text-indigo-800 border-indigo-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  lost: "bg-red-100 text-red-800 border-red-200"
};

const statusLabels = {
  open: "Open",
  scheduled: "Scheduled",
  quoted: "Quoted",
  invoiced: "Invoiced",
  paid: "Paid",
  completed: "Completed",
  lost: "Lost"
};

const productColors = {
  "Garage Door": "bg-[#fff9ed] text-slate-700", // Changed from #f0efe6 to #fff9ed
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
  "bg-[#fff9ed]", // Changed from #f0efe6 to #fff9ed
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
          className="hover:shadow-xl transition-all duration-200 cursor-pointer border-l-4 hover:scale-[1.01] active:scale-[0.99] group rounded-2xl border-2 border-[hsl(32,15%,88%)]"
          style={{ borderLeftColor: job.status === 'in_progress' ? '#fff9ed' : job.status === 'completed' ? '#10b981' : '#fae008', borderLeftWidth: '6px' }} {/* Changed #f0efe6 to #fff9ed */}
          onClick={() => onSelectJob(job)}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-xl text-[hsl(25,10%,12%)] truncate group-hover:text-[#fae008] transition-colors tracking-tight">{job.customer_name}</h3>
                  <Badge variant="outline" className="text-xs font-medium text-[hsl(25,8%,45%)] border-[hsl(32,15%,88%)]">
                    #{job.job_number}
                  </Badge>
                </div>
                
                <div className="flex items-start gap-2 text-[hsl(25,10%,25%)] mb-3">
                  <MapPin className="w-4 h-4 text-[#fae008] mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">{job.address}</span>
                </div>

                <div className="flex items-center gap-2">
                  {job.customer_phone && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(e) => handleCall(e, job.customer_phone)}
                      className="h-8 w-8 border-2 hover:bg-[#fff9ed] hover:border-slate-400 hover:text-slate-700 transition-all" // Changed #f0efe6 to #fff9ed
                      title="Call"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={(e) => handleDirections(e, job.address)}
                    className="h-8 w-8 border-2 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-all"
                      title="Directions"
                  >
                    <Navigation className="w-4 h-4" />
                  </Button>
                  {job.customer_email && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `mailto:${job.customer_email}`;
                      }}
                      className="h-8 w-8 border-2 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-all"
                      title="Email"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                    <>
                      <div className="w-px h-6 bg-[hsl(32,15%,88%)] mx-1"></div>
                      <div className="flex -space-x-2">
                        {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 3).map((name, idx) => (
                          <div
                            key={idx}
                            className={`${getAvatarColor(name)} w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm`}
                            title={name}
                          >
                            {getInitials(name)}
                          </div>
                        ))}
                        {Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 3 && (
                          <div className="bg-[hsl(32,15%,88%)] w-7 h-7 rounded-full flex items-center justify-center text-[hsl(25,10%,12%)] text-xs font-bold border-2 border-white shadow-sm">
                            +{job.assigned_to_name.length - 3}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 items-end ml-3">
                <Badge className={`${statusColors[job.status]} font-semibold shadow-sm border-2`}>
                  {statusLabels[job.status] || job.status}
                </Badge>
                {isTechnician && job.status === 'scheduled' && job.assigned_to?.includes(user?.email) && !hasActiveCheckIn(job.id) && (
                  <Button
                    size="sm"
                    onClick={(e) => handleCheckIn(e, job)}
                    disabled={checkInMutation.isPending}
                    className="bg-[#fff9ed] hover:bg-slate-200 text-slate-900 active:bg-slate-300 h-8 text-xs font-semibold shadow-sm transition-all" // Changed #f0efe6 to #fff9ed
                  >
                    <LogIn className="w-3.5 h-3.5 mr-1.5" />
                    Check In
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 bg-[hsl(32,25%,96%)] rounded-xl p-4 border border-[hsl(32,15%,88%)]">
                <div className="flex items-center gap-2 text-[hsl(25,10%,12%)]">
                  <Calendar className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                  <span className="text-sm font-semibold">
                    {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {job.scheduled_time && (
                  <div className="flex items-center gap-2 text-[hsl(25,10%,12%)]">
                    <Clock className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                    <span className="text-sm font-semibold">{job.scheduled_time}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {job.product && (
                    <Badge className={`${productColors[job.product]} font-semibold border`}>
                      <Timer className="w-3 h-3 mr-1" />
                      {job.product}
                    </Badge>
                  )}
                  
                  {job.job_type_name && (
                    <Badge className="bg-purple-50 text-purple-900 border-purple-200 border font-semibold">
                      <Timer className="w-3 h-3 mr-1" />
                      {job.job_type_name}
                    </Badge>
                  )}
                </div>

                {job.expected_duration && (
                  <Badge variant="outline" className="bg-white text-[hsl(25,10%,12%)] border-[hsl(32,15%,88%)] font-medium">
                    {job.expected_duration}h duration
                  </Badge>
                )}
              </div>

              {job.notes && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                  <div className="text-sm text-[hsl(25,10%,12%)] line-clamp-2">
                    <div dangerouslySetInnerHTML={{ __html: unescape(job.notes) }} />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
