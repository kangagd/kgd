
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin, Phone, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, DollarSign, Sparkles, LogIn, FileCheck, History, Package, ClipboardCheck, LogOut, Timer, AlertCircle, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  cancelled: "bg-slate-100 text-slate-800 border-slate-200"
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200"
};

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700"
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
  const [nextSteps, setNextSteps] = useState(job.next_steps || "");
  const [communicationWithClient, setCommunicationWithClient] = useState(job.communication_with_client || "");
  const [outcome, setOutcome] = useState(job.outcome || "");
  const [validationError, setValidationError] = useState("");
  const queryClient = useQueryClient();

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.filter({ is_active: true })
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
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
    queryFn: () => base44.entities.CheckInOut.filter({ job_id: job.id })
  });

  const activeCheckIn = checkIns.find((c) => !c.check_out_time && c.technician_email === user?.email);
  const completedCheckIns = checkIns.filter((c) => c.check_out_time);
  const totalJobTime = completedCheckIns.reduce((sum, c) => sum + (c.duration_hours || 0), 0);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const checkIn = await base44.entities.CheckInOut.create({
        job_id: job.id,
        technician_email: user.email,
        technician_name: user.full_name,
        check_in_time: new Date().toISOString()
      });
      await base44.entities.Job.update(job.id, { status: 'in_progress' });
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      // Validate required fields
      if (!overview || !nextSteps || !communicationWithClient || !outcome) {
        throw new Error("Please fill in all Site Visit fields before checking out.");
      }

      const checkOutTime = new Date().toISOString();
      const checkInTime = new Date(activeCheckIn.check_in_time);
      const durationHours = (new Date(checkOutTime) - checkInTime) / (1000 * 60 * 60);

      await base44.entities.CheckInOut.update(activeCheckIn.id, {
        check_out_time: checkOutTime,
        duration_hours: Math.round(durationHours * 10) / 10
      });
    },
    onSuccess: () => {
      setValidationError("");
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => {
      setValidationError(error.message);
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Job.update(job.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const updateMeasurementsMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(job.id, { measurements: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const logChange = async (fieldName, oldValue, newValue) => {
    if (!user) return;
    try {
      // Ensure values are stringified if they are arrays or objects for consistent logging
      const oldValString = typeof oldValue === 'object' && oldValue !== null ? JSON.stringify(oldValue) : String(oldValue);
      const newValString = typeof newValue === 'object' && newValue !== null ? JSON.stringify(newValue) : String(newValue);

      await base44.entities.ChangeHistory.create({
        job_id: job.id,
        field_name: fieldName,
        old_value: oldValString,
        new_value: newValString,
        changed_by: user.email,
        changed_by_name: user.full_name
      });
    } catch (error) {
      console.error("Error logging change:", error);
    }
  };

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const handleCheckIn = () => {
    checkInMutation.mutate();
  };

  const handleCheckOut = () => {
    setValidationError("");
    checkOutMutation.mutate();
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

  const handleNextStepsBlur = () => {
    if (nextSteps !== job.next_steps) {
      logChange('next_steps', job.next_steps, nextSteps);
      updateJobMutation.mutate({ field: 'next_steps', value: nextSteps });
    }
  };

  const handleCommunicationBlur = () => {
    if (communicationWithClient !== job.communication_with_client) {
      logChange('communication_with_client', job.communication_with_client, communicationWithClient);
      updateJobMutation.mutate({ field: 'communication_with_client', value: communicationWithClient });
    }
  };

  const handleOutcomeChange = (value) => {
    setOutcome(value);
    logChange('outcome', job.outcome, value);
    updateJobMutation.mutate({ field: 'outcome', value });
  };

  const handleAssignedToChange = (emails) => {
    // Ensure `emails` is an array of emails for consistency
    const newAssignedEmails = Array.isArray(emails) ? emails : emails ? [emails] : [];

    // `job.assigned_to` could be a string or an array from the backend, normalize for logChange
    const currentAssignedToNormalized = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];

    // Update the 'assigned_to' field in the job
    handleFieldSave('assigned_to', currentAssignedToNormalized, newAssignedEmails);

    // Prepare the 'assigned_to_name' for display/storage
    const techNames = newAssignedEmails.
    map((email) => {
      const tech = technicians.find((t) => t.email === email);
      return tech?.full_name; // Only take full_name, filter out undefined later
    }).
    filter(Boolean); // Filter out any technicians not found or null names

    // Update 'assigned_to_name' with a comma-separated string
    updateJobMutation.mutate({ field: 'assigned_to_name', value: techNames.join(', ') });
  };

  const handleJobTypeChange = (jobTypeId) => {
    const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
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

  const customerTypeColors = {
    "Owner": "bg-purple-100 text-purple-700",
    "Builder": "bg-blue-100 text-blue-700",
    "Real Estate - Tenant": "bg-green-100 text-green-700",
    "Strata - Owner": "bg-amber-100 text-amber-700",
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
                {job.customer_type && (
                  <Badge variant="outline" className={`${customerTypeColors[job.customer_type]} mt-1`}>
                    {job.customer_type}
                  </Badge>
                )}
                <p className="text-xs md:text-sm text-slate-500 mt-1">Job #{job.job_number}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin className="text-[#fae008] lucide lucide-map-pin w-4 h-4 flex-shrink-0" />
                  <span className="text-sm md:text-base font-bold text-slate-900">{job.address}</span>
                </div>
                {job.customer_phone &&
                <a href={`tel:${job.customer_phone}`} className="flex items-center gap-2 mt-2 text-slate-700 hover:text-orange-600 transition-colors">
                    <Phone className="text-[#fae008] lucide lucide-phone w-4 h-4" />
                    <span className="text-sm md:text-base font-medium">{job.customer_phone}</span>
                  </a>
                }
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
                className="h-8 px-2">

                <History className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline text-xs">History</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPriceList(true)}
                className="h-8 px-2">

                <DollarSign className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline text-xs">Price List</span>
              </Button>
              {!isTechnician &&
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssistant(true)}
                className="h-8 px-2">

                  <Sparkles className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">AI</span>
                </Button>
              }
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="details" className="text-xs md:text-sm">Details</TabsTrigger>
              <TabsTrigger value="visit" className="text-xs md:text-sm">
                <ClipboardCheck className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Site Visit</span>
              </TabsTrigger>
              <TabsTrigger value="form" className="text-xs md:text-sm">
                <FileCheck className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Form</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs md:text-sm">
                <ImageIcon className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Files</span>
              </TabsList>

            <TabsContent value="details" className="space-y-3 md:space-y-4 mt-3 md:mt-4">
              <div className="grid gap-3 md:gap-4">
                <div className="space-y-2 md:space-y-3">
                  <div className="grid grid-cols-3 gap-2 md:gap-3">
                    <EditableField
                      value={job.scheduled_date}
                      onSave={(val) => handleFieldSave('scheduled_date', job.scheduled_date, val)}
                      type="date"
                      icon={Calendar}
                      displayFormat={(val) => format(parseISO(val), 'MMM d, yyyy')}
                      placeholder="Set date" />

                    <EditableField
                      value={job.scheduled_time}
                      onSave={(val) => handleFieldSave('scheduled_time', job.scheduled_time, val)}
                      type="time"
                      icon={Clock}
                      placeholder="Set time" />

                    <div className="col-span-3"> {/* This wrapper ensures it takes full width below other fields */}
                      <EditableField
                        value={Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : []}
                        onSave={handleAssignedToChange}
                        type="multi-select"
                        icon={User}
                        options={technicians.map((t) => ({ value: t.email, label: t.full_name }))}
                        displayFormat={(val) => {
                          const emailsToDisplay = Array.isArray(val) ? val : val ? [val] : [];
                          if (emailsToDisplay.length === 0) return "Unassigned";
                          const names = emailsToDisplay.map((email) => {
                            const tech = technicians.find((t) => t.email === email);
                            return tech?.full_name || email;
                          });
                          return names.join(", ");
                        }}
                        placeholder="Assign technicians" />

                    </div>
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
                      { value: "Custom Garage Door", label: "Custom Garage Door" }]
                      }
                      className={job.product ? productColors[job.product] : ""}
                      placeholder="Select product" />

                    <EditableField
                      value={job.job_type_id}
                      onSave={handleJobTypeChange}
                      type="select"
                      icon={Briefcase}
                      options={jobTypes.map((jt) => ({ value: jt.id, label: jt.name }))}
                      displayFormat={(val) => jobTypes.find((jt) => jt.id === val)?.name || val}
                      placeholder="Select job type" />

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
                    className="text-xs md:text-sm bg-white border-amber-300 focus:border-amber-400 focus:ring-amber-400" />

                </div>
              </div>

              <div>
                <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">Pricing Provided</h3>
                <Input
                  value={pricingProvided}
                  onChange={(e) => setPricingProvided(e.target.value)}
                  onBlur={handlePricingProvidedBlur}
                  placeholder="Enter pricing information..."
                  className="text-xs md:text-sm bg-slate-50 border-slate-300" />

              </div>

              <div>
                <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">Additional Information</h3>
                <Textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  onBlur={handleAdditionalInfoBlur}
                  placeholder="Add any additional information..."
                  rows={3}
                  className="text-xs md:text-sm bg-slate-50 border-slate-300" />

              </div>

              <div className="flex flex-col gap-2 pt-2 border-t">
                {!activeCheckIn ?
                <Button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg">

                    <LogIn className="w-4 h-4 mr-2" />
                    {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                  </Button> :

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Timer className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Checked in at {format(new Date(activeCheckIn.check_in_time), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                }
                {totalJobTime > 0 &&
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Total Job Time:</span>
                      <span className="text-sm font-semibold text-slate-900">{totalJobTime.toFixed(1)} hours</span>
                    </div>
                  </div>
                }
              </div>
            </TabsContent>

            <TabsContent value="visit" className="space-y-3 md:space-y-4 mt-3 md:mt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="visit-overview" className="text-sm md:text-base font-semibold text-slate-900 mb-2">Overview *</Label>
                  <Textarea
                    id="visit-overview"
                    value={overview}
                    onChange={(e) => setOverview(e.target.value)}
                    onBlur={handleOverviewBlur}
                    placeholder="Describe the site visit overview..."
                    rows={4}
                    className="text-xs md:text-sm bg-slate-50 border-slate-300 mt-2" />

                </div>

                <div>
                  <Label htmlFor="next-steps" className="text-sm md:text-base font-semibold text-slate-900 mb-2">Next Steps *</Label>
                  <Textarea
                    id="next-steps"
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    onBlur={handleNextStepsBlur}
                    placeholder="What are the next steps..."
                    rows={4}
                    className="text-xs md:text-sm bg-slate-50 border-slate-300 mt-2" />

                </div>

                <div>
                  <Label htmlFor="communication" className="text-sm md:text-base font-semibold text-slate-900 mb-2">Communication with Client *</Label>
                  <Textarea
                    id="communication"
                    value={communicationWithClient}
                    onChange={(e) => setCommunicationWithClient(e.target.value)}
                    onBlur={handleCommunicationBlur}
                    placeholder="Notes on communication with client..."
                    rows={4}
                    className="text-xs md:text-sm bg-slate-50 border-slate-300 mt-2" />

                </div>

                <div>
                  <Label htmlFor="outcome" className="text-sm md:text-base font-semibold text-slate-900 mb-2">Outcome *</Label>
                  <Select value={outcome} onValueChange={handleOutcomeChange}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_quote">New Quote</SelectItem>
                      <SelectItem value="update_quote">Update Quote</SelectItem>
                      <SelectItem value="send_invoice">Send Invoice</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="return_visit_required">Return Visit Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {validationError &&
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-700">{validationError}</span>
                  </div>
                }

                {activeCheckIn &&
                <div className="pt-4 border-t">
                    <Button
                    onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    size="lg">

                      <LogOut className="w-4 h-4 mr-2" />
                      {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                    </Button>
                  </div>
                }

                {completedCheckIns.length > 0 &&
                <Collapsible defaultOpen={false} className="pt-4 border-t">
                    <CollapsibleTrigger className="flex items-center justify-between w-full group">
                      <h4 className="text-sm font-semibold text-slate-900">Time Tracking ({completedCheckIns.length} {completedCheckIns.length === 1 ? 'visit' : 'visits'})</h4>
                      <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="pt-3 space-y-3">
                      {completedCheckIns.map((checkIn, index) =>
                    <div key={checkIn.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Visit {completedCheckIns.length - index}</span>
                              <span className="text-xs font-medium text-slate-700">{checkIn.technician_name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500">Check In:</span>
                                <div className="font-medium text-slate-900">
                                  {format(new Date(checkIn.check_in_time), 'MMM d, h:mm a')}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500">Check Out:</span>
                                <div className="font-medium text-slate-900">
                                  {format(new Date(checkIn.check_out_time), 'MMM d, h:mm a')}
                                </div>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-300">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600">Duration:</span>
                                <span className="text-sm font-semibold text-slate-900">
                                  {checkIn.duration_hours.toFixed(1)} hours
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                    )}

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900">Total Time:</span>
                          <span className="text-lg font-bold text-blue-900">{totalJobTime.toFixed(1)} hours</span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                }
              </div>
            </TabsContent>

            <TabsContent value="form" className="mt-3 md:mt-4">
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-sm md:text-base font-semibold text-slate-900">Measurements & Form</h3>
                <MeasurementsForm
                  measurements={measurements}
                  onChange={handleMeasurementsChange} />

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
                  emptyText="Click to upload photos" />


                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <EditableFileUpload
                    files={job.quote_url}
                    onFilesChange={handleQuoteChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Quote"
                    emptyText="Click to upload quote" />


                  <EditableFileUpload
                    files={job.invoice_url}
                    onFilesChange={handleInvoiceChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Invoice"
                    emptyText="Click to upload invoice" />

                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <PriceListModal
        open={showPriceList}
        onClose={() => setShowPriceList(false)} />


      <ChangeHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        jobId={job.id} />


      {!isTechnician &&
      <TechnicianAssistant
        open={showAssistant}
        onClose={() => setShowAssistant(false)}
        job={job} />

      }
    </>);

}
