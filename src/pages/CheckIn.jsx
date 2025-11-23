import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, CheckCircle, LogIn, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CheckIn() {
  const [user, setUser] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [notes, setNotes] = useState("");
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
    queryKey: ['myJobs', user?.email],
    queryFn: () => base44.entities.Job.filter({ 
      assigned_to: user?.email,
      status: ['scheduled', 'in_progress']
    }),
    enabled: !!user?.email,
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['myCheckIns', user?.email],
    queryFn: () => base44.entities.CheckInOut.filter({ 
      technician_email: user?.email 
    }, '-created_date'),
    enabled: !!user?.email,
  });

  const activeCheckIn = checkIns.find(ci => !ci.check_out_time);

  const checkInMutation = useMutation({
    mutationFn: async (data) => {
      const checkIn = await base44.entities.CheckInOut.create(data);
      await base44.entities.Job.update(data.job_id, { status: 'in_progress' });
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCheckIns'] });
      queryClient.invalidateQueries({ queryKey: ['myJobs'] });
      setSelectedJobId("");
      setNotes("");
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async ({ checkInId, jobId, notes }) => {
      const checkOutTime = new Date().toISOString();
      const checkIn = checkIns.find(ci => ci.id === checkInId);
      const duration = (new Date(checkOutTime) - new Date(checkIn.check_in_time)) / (1000 * 60 * 60);
      
      await base44.entities.CheckInOut.update(checkInId, {
        check_out_time: checkOutTime,
        check_out_notes: notes,
        duration_hours: duration
      });
      
      await base44.entities.Job.update(jobId, { 
        status: 'completed',
        completion_notes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCheckIns'] });
      queryClient.invalidateQueries({ queryKey: ['myJobs'] });
      setNotes("");
    },
  });

  const handleCheckIn = () => {
    if (!selectedJobId) return;
    
    checkInMutation.mutate({
      job_id: selectedJobId,
      technician_email: user.email,
      technician_name: user.full_name,
      check_in_time: new Date().toISOString(),
      check_in_notes: notes,
    });
  };

  const handleCheckOut = () => {
    if (!activeCheckIn) return;
    
    checkOutMutation.mutate({
      checkInId: activeCheckIn.id,
      jobId: activeCheckIn.job_id,
      notes: notes,
    });
  };

  const getJobDetails = (jobId) => {
    return jobs.find(j => j.id === jobId);
  };

  return (
    <div className="p-4 md:p-8 bg-[#ffffff] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Check In/Out</h1>
          <p className="text-slate-500 mt-1">Track your time on job sites</p>
        </div>

        {activeCheckIn ? (
          <Card className="border-none shadow-lg mb-6">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <CardTitle>Currently Checked In</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {(() => {
                const job = getJobDetails(activeCheckIn.job_id);
                return job ? (
                  <>
                    <div className="space-y-3 mb-6">
                      <div>
                        <h3 className="font-semibold text-lg">{job.customer_name}</h3>
                        <p className="text-slate-500">{job.job_number}</p>
                      </div>
                      <div className="flex items-start gap-2 text-slate-700">
                        <MapPin className="w-4 h-4 mt-1 text-slate-400" />
                        <span>{job.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">
                          Checked in at {format(parseISO(activeCheckIn.check_in_time), 'h:mm a')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Completion Notes
                        </label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add notes about the work completed..."
                          rows={4}
                        />
                      </div>
                      <Button
                        onClick={handleCheckOut}
                        disabled={checkOutMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        <LogOut className="w-5 h-5 mr-2" />
                        {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500">Loading job details...</p>
                );
              })()}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-lg mb-6">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Check In to a Job</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Job
                  </label>
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a job to check in" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.customer_name} - {job.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedJobId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes (Optional)
                      </label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any initial notes..."
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleCheckIn}
                      disabled={checkInMutation.isPending}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      size="lg"
                    >
                      <LogIn className="w-5 h-5 mr-2" />
                      {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-lg">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Recent Check-Ins</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {checkIns.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No check-ins yet
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {checkIns.slice(0, 10).map((checkIn) => {
                  const job = getJobDetails(checkIn.job_id);
                  return (
                    <div key={checkIn.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          {job && (
                            <>
                              <h3 className="font-semibold text-slate-900">{job.customer_name}</h3>
                              <p className="text-sm text-slate-500">{job.address}</p>
                            </>
                          )}
                        </div>
                        <Badge className={checkIn.check_out_time ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>
                          {checkIn.check_out_time ? "Completed" : "In Progress"}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {format(parseISO(checkIn.check_in_time), 'MMM d, h:mm a')}
                            {checkIn.check_out_time && 
                              ` - ${format(parseISO(checkIn.check_out_time), 'h:mm a')}`
                            }
                          </span>
                        </div>
                        {checkIn.duration_hours && (
                          <p className="text-xs text-slate-500">
                            Duration: {checkIn.duration_hours.toFixed(1)} hours
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}