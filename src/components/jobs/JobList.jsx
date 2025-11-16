
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, User, Briefcase, FileText, LogIn, Package, Phone, Mail, Navigation, ChevronDown, ChevronUp } from "lucide-react";
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
  "Garage Door": "bg-blue-100 text-blue-700 border-blue-200",
  "Gate": "bg-green-100 text-green-700 border-green-200",
  "Roller Shutter": "bg-purple-100 text-purple-700 border-purple-200",
  "Multiple": "bg-orange-100 text-orange-700 border-orange-200",
  "Custom Garage Door": "bg-pink-100 text-pink-700 border-pink-200",
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
  const [expandedNotes, setExpandedNotes] = useState({});
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

  const toggleNotes = (e, jobId) => {
    e.stopPropagation();
    setExpandedNotes(prev => ({ ...prev, [jobId]: !prev[jobId] }));
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
          className="hover:shadow-xl transition-all duration-200 cursor-pointer border-l-4 hover:scale-[1.01] group"
          style={{ borderLeftColor: job.status === 'in_progress' ? '#3b82f6' : job.status === 'completed' ? '#10b981' : '#fae008' }}
          onClick={() => onSelectJob(job)}
        >
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-xl text-slate-900 truncate group-hover:text-blue-600 transition-colors">{job.customer_name}</h3>
                  <Badge variant="outline" className="text-xs font-normal text-slate-500 border-slate-300">
                    #{job.job_number}
                  </Badge>
                </div>
                
                <div className="flex items-start gap-2 text-slate-700 mb-3">
                  <MapPin className="w-4 h-4 text-[#fae008] mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">{job.address}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {job.customer_phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleCall(e, job.customer_phone)}
                      className="h-8 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                    >
                      <Phone className="w-3.5 h-3.5 mr-1.5" />
                      Call
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleDirections(e, job.address)}
                    className="h-8 text-xs hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                  >
                    <Navigation className="w-3.5 h-3.5 mr-1.5" />
                    Directions
                  </Button>
                  {job.customer_email && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `mailto:${job.customer_email}`;
                      }}
                      className="h-8 text-xs hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
                    >
                      <Mail className="w-3.5 h-3.5 mr-1.5" />
                      Email
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 items-end ml-3">
                <Badge className={`${statusColors[job.status]} font-medium shadow-sm`}>
                  {statusLabels[job.status] || job.status}
                </Badge>
                {isTechnician && job.status === 'scheduled' && job.assigned_to?.includes(user?.email) && !hasActiveCheckIn(job.id) && (
                  <Button
                    size="sm"
                    onClick={(e) => handleCheckIn(e, job.id)}
                    disabled={checkInMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 h-8 text-xs font-medium shadow-sm"
                  >
                    <LogIn className="w-3.5 h-3.5 mr-1.5" />
                    Check In
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium">
                    {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {job.scheduled_time && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium">{job.scheduled_time}</span>
                  </div>
                )}

                {/* Moved product and job_type_name badges here */}
                <div className="flex items-center gap-2">
                  {job.product && (
                    <Badge className={`${productColors[job.product]} font-medium`}>
                      <Package className="w-3 h-3 mr-1" />
                      {job.product}
                    </Badge>
                  )}
                  
                  {job.job_type_name && (
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-medium">
                      <Briefcase className="w-3 h-3 mr-1" />
                      {job.job_type_name}
                    </Badge>
                  )}
                </div>

                {job.expected_duration && (
                  <Badge variant="outline" className="bg-white text-slate-700 border-slate-300">
                    {job.expected_duration}h duration
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <div className="flex -space-x-2">
                      {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 3).map((name, idx) => (
                        <div
                          key={idx}
                          className={`${getAvatarColor(name)} w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm`}
                          title={name}
                        >
                          {getInitials(name)}
                        </div>
                      ))}
                      {Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 3 && (
                        <div className="bg-slate-300 w-8 h-8 rounded-full flex items-center justify-center text-slate-700 text-xs font-bold border-2 border-white shadow-sm">
                          +{job.assigned_to_name.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {job.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
                  <button
                    onClick={(e) => toggleNotes(e, job.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-amber-800">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">Notes</span>
                    </div>
                    {expandedNotes[job.id] ? (
                      <ChevronUp className="w-4 h-4 text-amber-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-amber-600" />
                    )}
                  </button>
                  {expandedNotes[job.id] && (
                    <div className="px-3 pb-3 text-sm text-slate-700">
                      <div dangerouslySetInnerHTML={{ __html: job.notes }} />
                    </div>
                  )}
                  {!expandedNotes[job.id] && (
                    <div className="px-3 pb-3 text-sm text-slate-600 line-clamp-1">
                      <div dangerouslySetInnerHTML={{ __html: job.notes }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
