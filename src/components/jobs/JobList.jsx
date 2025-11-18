import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, LogIn, Phone, Mail, Navigation, Timer, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unescape } from "lodash";

const statusColors = {
  open: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  scheduled: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  quoted: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  invoiced: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  completed: "bg-green-500/10 text-green-700 border-green-500/20",
  cancelled: "bg-gray-500/10 text-gray-700 border-gray-500/20"
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
  "Garage Door": "bg-yellow-500/10 text-yellow-800 border-yellow-500/20",
  "Gate": "bg-green-500/10 text-green-800 border-green-500/20",
  "Roller Shutter": "bg-purple-500/10 text-purple-800 border-purple-500/20",
  "Multiple": "bg-orange-500/10 text-orange-800 border-orange-500/20",
  "Custom Garage Door": "bg-pink-500/10 text-pink-800 border-pink-500/20"
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
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse shadow-sm border border-slate-200">
            <CardContent className="p-4">
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
      <Card className="p-12 text-center shadow-sm border border-slate-200">
        <Timer className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-900 mb-1">No jobs found</h3>
        <p className="text-sm text-slate-500">Try adjusting your filters</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Card 
          key={job.id}
          className="hover:shadow-md transition-all duration-200 cursor-pointer shadow-sm border border-slate-200"
          onClick={() => onSelectJob(job)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-slate-900 truncate">{job.customer_name}</h3>
                  <span className="text-xs text-slate-500">#{job.job_number}</span>
                </div>
                
                <div className="flex items-start gap-1.5 text-slate-600 mb-2">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span className="text-sm">{job.address}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {job.customer_phone && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => handleCall(e, job.customer_phone)}
                      className="h-7 w-7 hover:bg-slate-100"
                      title="Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => handleDirections(e, job.address)}
                    className="h-7 w-7 hover:bg-slate-100"
                    title="Directions"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                  </Button>
                  {job.customer_email && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `mailto:${job.customer_email}`;
                      }}
                      className="h-7 w-7 hover:bg-slate-100"
                      title="Email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  
                  {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                    <>
                      <div className="w-px h-5 bg-slate-200 mx-1"></div>
                      <div className="flex -space-x-1.5">
                        {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 3).map((name, idx) => (
                          <div
                            key={idx}
                            className={`${getAvatarColor(name)} w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white`}
                            title={name}
                          >
                            {getInitials(name)}
                          </div>
                        ))}
                        {Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 3 && (
                          <div className="bg-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-slate-700 text-xs font-medium border-2 border-white">
                            +{job.assigned_to_name.length - 3}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 items-end">
                <Badge className={`${statusColors[job.status]} rounded-full px-2.5 py-0.5 text-xs font-medium border`}>
                  {statusLabels[job.status] || job.status}
                </Badge>
                {isTechnician && job.status === 'scheduled' && job.assigned_to?.includes(user?.email) && !hasActiveCheckIn(job.id) && (
                  <Button
                    size="sm"
                    onClick={(e) => handleCheckIn(e, job)}
                    disabled={checkInMutation.isPending}
                    className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 h-7 px-2.5 text-xs font-medium rounded-lg"
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    Check In
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">
                    {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {job.scheduled_time && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">{job.scheduled_time}</span>
                  </div>
                )}

                {job.product && (
                  <Badge className={`${productColors[job.product]} rounded-full px-2 py-0.5 text-xs font-medium border`}>
                    {job.product}
                  </Badge>
                )}
                
                {job.job_type_name && (
                  <Badge className="bg-purple-500/10 text-purple-800 border-purple-500/20 rounded-full px-2 py-0.5 text-xs font-medium border">
                    {job.job_type_name}
                  </Badge>
                )}
              </div>
            </div>

            {job.notes && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <div className="text-xs text-slate-700 line-clamp-2" dangerouslySetInnerHTML={{ __html: unescape(job.notes) }} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}