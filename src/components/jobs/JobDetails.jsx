import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin, Phone, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, DollarSign, Sparkles, LogIn, FileCheck, History, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PriceListModal from "./PriceListModal";
import TechnicianAssistant from "./TechnicianAssistant";
import MeasurementsForm from "./MeasurementsForm";
import ChangeHistoryModal from "./ChangeHistoryModal";
import EditableField from "./EditableField";
import EditableFileUpload from "./EditableFileUpload";

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

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700",
};

export default function JobDetails({ job, onClose, onStatusChange }) {
  const [showPriceList, setShowPriceList] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [user, setUser] = useState(null);
  const [measurements, setMeasurements] = useState(job.measurements || null);
  const [notes, setNotes] = useState(job.notes || "");
  const [overview, setOverview] = useState(job.overview || "");
  const [pricingProvided, setPricingProvided] = useState(job.pricing_provided || "");
  const [additionalInfo, setAdditionalInfo] = useState(job.additional_info || "");
  const queryClient = useQueryClient();

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.filter({ is_active: true }),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
  });

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
    queryKey: ['checkIns', job.id],
    queryFn: () => base44.entities.CheckInOut.filter({ job_id: job.id }),
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

  const updateJobMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Job.update(job.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
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

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const handleCheckIn = () => {
    checkInMutation.mutate();
  };

  const handleMeasurementsChange = (data) => {
    setMeasurements(data);
    updateMeasurementsMutation.mutate(data);
  };

  const handleFieldSave = (fieldName, oldValue, newValue) => {
    logChange(fieldName, oldValue, newValue);
    updateJobMutation.mutate({ field: fieldName, value: newValue });
  };

  const handleNotesBlur = () => {
    if (notes !== job.notes) {
      logChange('notes', job.notes, notes);
      updateJobMutation.mutate({ field: 'notes', value: notes });
    }
  };

  const handleOverviewBlur = () => {
    if (overview !== job.overview) {
      logChange('overview', job.overview, overview);
      updateJobMutation.mutate({ field: 'overview', value: overview });
    }
  };

  const handlePricingProvidedBlur = () => {
    if (pricingProvided !== job.pricing_provided) {
      logChange('pricing_provided', job.pricing_provided, pricingProvided);
      updateJobMutation.mutate({ field: 'pricing_provided', value: pricingProvided });
    }
  };

  const handleAdditionalInfoBlur = () => {
    if (additionalInfo !== job.additional_info) {
      logChange('additional_info', job.additional_info, additionalInfo);
      updateJobMutation.mutate({ field: 'additional_info', value: additionalInfo });
    }
  };

  const handleAssignedToChange = (email) => {
    const tech = technicians.find(t => t.email === email);
    handleFieldSave('assigned_to', job.assigned_to, email);
    if (tech) {
      updateJobMutation.mutate({ field: 'assigned_to_name', value: tech.full_name });
    }
  };

  const handleJobTypeChange = (jobTypeId) => {
    const jobType = jobTypes.find(jt => jt.id === jobTypeId);
    handleFieldSave('job_type_id', job.job_type_id, jobTypeId);
    if (jobType) {
      updateJobMutation.mutate({ field: 'job_type_name', value: jobType.name });
    }
  };

  const handleImagesChange = (urls) => {
    updateJobMutation.mutate({ field: 'image_urls', value: urls });
  };

  const handleQuoteChange = (url) => {
    updateJobMutation.mutate({ field: 'quote_url', value: url });
  };

  const handleInvoiceChange = (url) => {
    updateJobMutation.mutate({ field: 'invoice_url', value: url });
  };

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
                  <CardTitle className="text-lg md:text-2xl font-bold">{job.customer_name}</CardTitle>
                  <Badge className={`${statusColors[job.status]} pointer-events-none`}>
                    {job.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-slate-500 mt-1">Job #{job.job_number}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  <span className="text-sm md:text-base font-bold text-slate-900">{job.address}</span>
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
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
                className="h-8 px-2"
              >
                <History className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline text-xs">History</span>
              </Button>
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
              <TabsTrigger value="form" className="text-xs md:text-sm">
                <FileCheck className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Form</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs md:text-sm">
                <ImageIcon className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Files</span>
              </TabsTrigger>
              {!isTechnician && (
                <TabsTrigger value="assistant" className="text-xs md:text-sm">
                  <Sparkles className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                  <span className="hidden md:inline">AI</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-3 md:space-y-4 mt-3 md:mt-4">
              {job.outcome && (
                <div className="flex gap-2 flex-wrap">
                  <Badge className={outcomeColors[job.outcome]}>
                    {job.outcome.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}

              <div className="grid gap-3 md:gap-4">
                <div className="space-y-2 md:space-y-3">
                  <div className="grid grid-cols-3 gap-2 md:gap-3">
                    <EditableField
                      value={job.scheduled_date}
                      onSave={(val) => handleFieldSave('scheduled_date', job.scheduled_date, val)}
                      type="date"
                      icon={Calendar}
                      displayFormat={(val) => format(parseISO(val), 'MMM d, yyyy')}
                      placeholder="Set date"
                    />
                    <EditableField
                      value={job.scheduled_time}
                      onSave={(val) => handleFieldSave('scheduled_time', job.scheduled_time, val)}
                      type="time"
                      icon={Clock}
                      placeholder="Set time"
                    />
                    <EditableField
                      value={job.assigned_to}
                      onSave={handleAssignedToChange}
                      type="select"
                      icon={User}
                      options={technicians.map(t => ({ value: t.email, label: t.full_name }))}
                      displayFormat={(val) => technicians.find(t => t.email === val)?.full_name || val}
                      placeholder="Assign"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <EditableField
                      value={job.product}
                      onSave={(val) => handleFieldSave('product', job.product, val)}
                      type="select"
                      icon={Package}
                      options={[
                        { value: "Garage Door", label: "Garage Door" },
                        { value: "Gate", label: "Gate" },
                        { value: "Roller Shutter", label: "Roller Shutter" },
                        { value: "Multiple", label: "Multiple" },
                        { value: "Custom Garage Door", label: "Custom Garage Door" }
                      ]}
                      className={job.product ? productColors[job.product] : ""}
                      placeholder="Select product"
                    />
                    <EditableField
                      value={job.job_type_id}
                      onSave={handleJobTypeChange}
                      type="select"
                      icon={Briefcase}
                      options={jobTypes.map(jt => ({ value: jt.id, label: jt.name }))}
                      displayFormat={(val) => jobTypes.find(jt => jt.id === val)?.name || val}
                      placeholder="Select job type"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 md:pt-4">
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

              <div>
                <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">Overview</h3>
                <Textarea
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  onBlur={handleOverviewBlur}
                  placeholder="Add job overview..."
                  rows={3}
                  className="text-xs md:text-sm bg-slate-50 border-slate-300"
                />
              </div>

              <div>
                <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">Pricing Provided</h3>
                <Input
                  value={pricingProvided}
                  onChange={(e) => setPricingProvided(e.target.value)}
                  onBlur={handlePricingProvidedBlur}
                  placeholder="Enter pricing information..."
                  className="text-xs md:text-sm bg-slate-50 border-slate-300"
                />
              </div>

              <div>
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

              <div className="flex flex-col gap-2 pt-2">
                {!activeCheckIn && job.status === 'scheduled' && (
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkInMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
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

            <TabsContent value="files" className="mt-3 md:mt-4">
              <div className="space-y-4">
                <EditableFileUpload
                  files={job.image_urls || []}
                  onFilesChange={handleImagesChange}
                  accept="image/*"
                  multiple={true}
                  icon={ImageIcon}
                  label="Photos"
                  emptyText="Click to upload photos"
                />

                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <EditableFileUpload
                    files={job.quote_url}
                    onFilesChange={handleQuoteChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Quote"
                    emptyText="Click to upload quote"
                  />

                  <EditableFileUpload
                    files={job.invoice_url}
                    onFilesChange={handleInvoiceChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Invoice"
                    emptyText="Click to upload invoice"
                  />
                </div>
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