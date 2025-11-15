import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Edit, MapPin, Phone, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, DollarSign, Sparkles, FileCheck, History, Camera, LogIn, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PriceListModal from "./PriceListModal";
import TechnicianAssistant from "./TechnicianAssistant";
import MeasurementsForm from "./MeasurementsForm";
import ChangeHistoryModal from "./ChangeHistoryModal";
import NavigationCard from "./NavigationCard";
import CheckOutDialog from "./CheckOutDialog";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function JobDetails({ job, onClose, onEdit, onStatusChange }) {
  const [showPriceList, setShowPriceList] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [measurements, setMeasurements] = useState(job?.measurements || null);
  const [notes, setNotes] = useState(job?.notes || "");
  const [additionalInfo, setAdditionalInfo] = useState(job?.additional_info || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
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

  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkIns', job?.id],
    queryFn: () => base44.entities.CheckInOut.filter({ job_id: job.id }),
    enabled: !!job?.id,
  });

  const activeCheckIn = checkIns.find(c => !c.check_out_time && c.technician_email === user?.email);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const checkIn = await base44.entities.CheckInOut.create({
        job_id: job.id,
        technician_email: user.email,
        technician_name: user.full_name,
        check_in_time: new Date().toISOString(),
      });
      await base44.entities.Job.update(job.id, { status: 'in_progress' });
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (outcome) => {
      const checkOutTime = new Date().toISOString();
      const checkInTime = new Date(activeCheckIn.check_in_time);
      const durationHours = (new Date(checkOutTime) - checkInTime) / (1000 * 60 * 60);

      await base44.entities.CheckInOut.update(activeCheckIn.id, {
        check_out_time: checkOutTime,
        duration_hours: Math.round(durationHours * 100) / 100,
      });

      await base44.entities.Job.update(job.id, {
        status: 'completed',
        outcome: outcome,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setShowCheckOutDialog(false);
    },
  });

  const updateMeasurementsMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(job.id, { measurements: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const logChange = async (fieldName, oldValue, newValue) => {
    if (!user) return;
    try {
      await base44.entities.ChangeHistory.create({
        job_id: job.id,
        field_name: fieldName,
        old_value: oldValue || "",
        new_value: newValue || "",
        changed_by: user.email,
        changed_by_name: user.full_name,
      });
    } catch (error) {
      console.error("Error logging change:", error);
    }
  };

  const updateNotesMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(job.id, { notes: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const updateAdditionalInfoMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(job.id, { additional_info: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const currentImages = job.image_urls || [];
      await base44.entities.Job.update(job.id, {
        image_urls: [...currentImages, file_url]
      });
      return file_url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setUploading(false);
    },
  });

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const handleCheckIn = () => {
    checkInMutation.mutate();
  };

  const handleCheckOut = () => {
    setShowCheckOutDialog(true);
  };

  const handleConfirmCheckOut = (outcome) => {
    checkOutMutation.mutate(outcome);
  };

  const handleMeasurementsChange = (data) => {
    setMeasurements(data);
    updateMeasurementsMutation.mutate(data);
  };

  const handleNotesBlur = () => {
    if (notes !== job.notes) {
      logChange('notes', job.notes, notes);
      updateNotesMutation.mutate(notes);
    }
  };

  const handleAdditionalInfoBlur = () => {
    if (additionalInfo !== job.additional_info) {
      logChange('additional_info', job.additional_info, additionalInfo);
      updateAdditionalInfoMutation.mutate(additionalInfo);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadImageMutation.mutate(file);
    }
  };

  // Find next scheduled job for the technician on the same day
  const getNextJob = () => {
    if (!job || !user || !isTechnician) return null;
    
    const todayJobs = allJobs
      .filter(j => 
        j.scheduled_date === job.scheduled_date &&
        j.assigned_to === user.email &&
        j.id !== job.id &&
        (j.status === 'scheduled' || j.status === 'in_progress')
      )
      .sort((a, b) => {
        const timeA = a.scheduled_time || '23:59';
        const timeB = b.scheduled_time || '23:59';
        return timeA.localeCompare(timeB);
      });

    const currentJobTime = job.scheduled_time || '00:00';
    return todayJobs.find(j => (j.scheduled_time || '23:59') > currentJobTime);
  };

  const nextJob = getNextJob();

  if (!job) {
    return null;
  }

  return (
    <>
      <Card className={`border-none shadow-lg ${isTechnician ? 'rounded-none' : ''}`}>
        <CardHeader className="border-b border-slate-100 p-3 md:p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 md:gap-4 flex-1 min-w-0">
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg md:text-2xl font-bold">{job.customer_name || 'Unknown Customer'}</CardTitle>
                  <Badge className={statusColors[job.status]}>
                    {job.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-slate-500 mt-1">Job #{job.job_number}</p>
                <div className="flex items-center gap-1 mt-2">
                  <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  <span className="text-sm md:text-base font-bold text-slate-900 flex-1">{job.address}</span>
                </div>
                {job.customer_phone && (
                  <a href={`tel:${job.customer_phone}`} className="flex items-center gap-2 mt-2 text-slate-700 hover:text-orange-600 transition-colors">
                    <Phone className="w-4 h-4 text-orange-600" />
                    <span className="text-sm md:text-base font-medium">{job.customer_phone}</span>
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              {isTechnician && !activeCheckIn && job.status === 'scheduled' && (
                <Button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="h-8 px-2 bg-blue-600 hover:bg-blue-700"
                >
                  <LogIn className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">Check In</span>
                </Button>
              )}
              {isTechnician && activeCheckIn && (
                <Button
                  onClick={handleCheckOut}
                  disabled={checkOutMutation.isPending}
                  className="h-8 px-2 bg-green-600 hover:bg-green-700"
                >
                  <LogOut className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">Check Out</span>
                </Button>
              )}
              {!isTechnician && (
                <Button onClick={() => onEdit(job)} className="h-8 px-2 bg-orange-600 hover:bg-orange-700">
                  <Edit className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">Edit</span>
                </Button>
              )}
              {!isTechnician && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(true)}
                  className="h-8 px-2"
                >
                  <History className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">History</span>
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => setShowPriceList(true)}
                className="h-8 px-2"
              >
                <DollarSign className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline text-xs">Price List</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="details" className="text-xs md:text-sm">Details</TabsTrigger>
              <TabsTrigger value="files" className="text-xs md:text-sm">
                <ImageIcon className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Files</span>
              </TabsTrigger>
              <TabsTrigger value="form" className="text-xs md:text-sm">
                <FileCheck className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Form</span>
              </TabsTrigger>
              {!isTechnician && (
                <TabsTrigger value="assistant" className="text-xs md:text-sm">
                  <Sparkles className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                  <span className="hidden md:inline">AI</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-3 md:space-y-4 mt-3 md:mt-4">
              {isTechnician && (
                <NavigationCard currentJob={job} nextJob={nextJob} />
              )}

              {job.outcome && (
                <div className="flex gap-2 flex-wrap">
                  <Badge className={outcomeColors[job.outcome]}>
                    {job.outcome.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}

              <div className="grid gap-3 md:gap-4">
                <div className="space-y-2 md:space-y-3">
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <div className="flex items-center gap-2 p-2 md:p-3 bg-slate-50 rounded-lg">
                      <Calendar className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
                      <span className="text-xs md:text-sm">
                        {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {job.scheduled_time && (
                      <div className="flex items-center gap-2 p-2 md:p-3 bg-slate-50 rounded-lg">
                        <Clock className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
                        <span className="text-xs md:text-sm">{job.scheduled_time}</span>
                      </div>
                    )}
                  </div>
                  {job.job_type_name && (
                    <div className="flex items-center gap-2 p-2 md:p-3 bg-slate-50 rounded-lg">
                      <Briefcase className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
                      <span className="text-xs md:text-sm">{job.job_type_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-3 md:pt-4">
                <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">Additional Information</h3>
                <Textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  onBlur={handleAdditionalInfoBlur}
                  placeholder="Add any additional information..."
                  rows={3}
                  className="text-xs md:text-sm bg-slate-50 border-slate-300"
                />
              </div>

              <div>
                <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  Notes & Instructions
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 md:p-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    placeholder="Add notes and instructions for this job..."
                    rows={4}
                    className="text-xs md:text-sm bg-white border-amber-300 focus:border-amber-400 focus:ring-amber-400"
                  />
                </div>
              </div>

              {!isTechnician && (
                <div className="flex flex-col gap-2 pt-2">
                  {job.status === 'scheduled' && (
                    <Button
                      onClick={() => onStatusChange('in_progress')}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      size="lg"
                    >
                      Start Job
                    </Button>
                  )}
                  {job.status === 'in_progress' && (
                    <Button
                      onClick={() => onStatusChange('completed')}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      Complete Job
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="files" className="mt-3 md:mt-4">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm md:text-base font-semibold text-slate-900">Photos & Attachments</h3>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-orange-600 hover:bg-orange-700"
                    size="sm"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Take Photo'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                
                {job.image_urls && job.image_urls.length > 0 ? (
                  <div>
                    <h4 className="text-xs md:text-sm font-medium text-slate-500 mb-2">Photos ({job.image_urls.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {job.image_urls.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={url} 
                            alt={`Job ${index + 1}`} 
                            className="w-full h-24 md:h-32 object-cover rounded border hover:opacity-80"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs md:text-sm text-slate-500 text-center py-8">No photos uploaded</p>
                )}

                <div className="grid md:grid-cols-2 gap-3 md:gap-4 pt-4 border-t">
                  {job.quote_url ? (
                    <a href={job.quote_url} target="_blank" rel="noopener noreferrer" 
                       className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-xs md:text-sm font-medium">View Quote</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-slate-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs md:text-sm">No quote</span>
                    </div>
                  )}

                  {job.invoice_url ? (
                    <a href={job.invoice_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-xs md:text-sm font-medium">View Invoice</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-slate-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs md:text-sm">No invoice</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="form" className="mt-3 md:mt-4">
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-sm md:text-base font-semibold text-slate-900">Measurements & Form</h3>
                <MeasurementsForm
                  measurements={measurements}
                  onChange={handleMeasurementsChange}
                />
              </div>
            </TabsContent>

            {!isTechnician && (
              <TabsContent value="assistant" className="mt-3 md:mt-4">
                <TechnicianAssistant job={job} embedded={true} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <PriceListModal 
        open={showPriceList} 
        onClose={() => setShowPriceList(false)} 
      />

      <ChangeHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        jobId={job.id}
      />

      <CheckOutDialog
        open={showCheckOutDialog}
        onClose={() => setShowCheckOutDialog(false)}
        job={job}
        onConfirm={handleConfirmCheckOut}
        isSubmitting={checkOutMutation.isPending}
      />

      {!isTechnician && (
        <TechnicianAssistant
          open={showAssistant}
          onClose={() => setShowAssistant(false)}
          job={job}
        />
      )}
    </>
  );
}