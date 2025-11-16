
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin, Phone, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, DollarSign, Sparkles, LogIn, FileCheck, History, Package, ClipboardCheck, LogOut, Timer, AlertCircle, ChevronDown, Mail, Navigation } from "lucide-react";
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
import CustomerEditModal from "../customers/CustomerEditModal";
import RichTextEditor from "../common/RichTextEditor";

const statusColors = {
  open: "bg-slate-100 text-slate-800 border-slate-200",
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

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700",
  "Builder": "bg-blue-100 text-blue-700",
  "Real Estate - Tenant": "bg-green-100 text-green-700",
  "Strata - Owner": "bg-amber-100 text-amber-700",
};

const getInitials = (name) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
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

export default function JobDetails({ job, onClose, onStatusChange }) {
  const [showPriceList, setShowPriceList] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomerEdit, setShowCustomerEdit] = useState(false);
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

  const { data: customer } = useQuery({
    queryKey: ['customer', job.customer_id],
    queryFn: () => base44.entities.Customer.get(job.customer_id),
    enabled: !!job.customer_id
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

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', job.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setShowCustomerEdit(false);
    }
  });

  const logChange = async (fieldName, oldValue, newValue) => {
    if (!user) return;
    try {
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
    
    // Auto-set status to completed if outcome is completed or send_invoice
    if (value === 'completed' || value === 'send_invoice') {
      updateJobMutation.mutate({ field: 'status', value: 'completed' });
    }
  };

  const handleAssignedToChange = (emails) => {
    const newAssignedEmails = Array.isArray(emails) ? emails : emails ? [emails] : [];
    const currentAssignedToNormalized = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
    handleFieldSave('assigned_to', currentAssignedToNormalized, newAssignedEmails);
    const techNames = newAssignedEmails.map((email) => {
      const tech = technicians.find((t) => t.email === email);
      return tech?.full_name;
    }).filter(Boolean);
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

  const handleCustomerSubmit = (data) => {
    updateCustomerMutation.mutate({ id: job.customer_id, data });
  };

  return (
    <>
      <Card className={`border-none shadow-lg ${isTechnician ? 'rounded-none' : ''}`}>
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 flex-shrink-0 hover:bg-slate-200">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <CardTitle
                    className="text-lg md:text-xl font-bold cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setShowCustomerEdit(true)}
                  >
                    {job.customer_name}
                  </CardTitle>
                  {job.customer_type && (
                    <Badge variant="outline" className={`${customerTypeColors[job.customer_type]} text-xs font-medium`}>
                      {job.customer_type}
                    </Badge>
                  )}
                </div>
                
                <p className="text-xs text-slate-500 mb-1.5">Job #{job.job_number}</p>
              </div>
            </div>
            
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
                className="h-7 px-1.5 hover:bg-slate-100">
                <History className="w-3.5 h-3.5 md:mr-1" />
                <span className="hidden md:inline text-xs">History</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPriceList(true)}
                className="h-7 px-1.5 hover:bg-slate-100">
                <DollarSign className="w-3.5 h-3.5 md:mr-1" />
                <span className="hidden md:inline text-xs">Price</span>
              </Button>
              {!isTechnician && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssistant(true)}
                  className="h-7 px-1.5 hover:bg-slate-100">
                  <Sparkles className="w-3.5 h-3.5 md:mr-1" />
                  <span className="hidden md:inline text-xs">AI</span>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5">
              <MapPin className="text-slate-400 w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm md:text-base font-semibold text-slate-900">{job.address}</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {job.customer_phone && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.location.href = `tel:${job.customer_phone}`}
                  className="h-7 w-7 hover:bg-blue-100 text-slate-600 hover:text-blue-700"
                  title="Call"
                >
                  <Phone className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
                className="h-7 w-7 hover:bg-green-100 text-slate-600 hover:text-green-700"
                title="Directions"
              >
                <Navigation className="w-4 h-4" />
              </Button>
              {job.customer_email && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.location.href = `mailto:${job.customer_email}`}
                  className="h-7 w-7 hover:bg-purple-100 text-slate-600 hover:text-purple-700"
                  title="Email"
                >
                  <Mail className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-slate-200 shadow-sm">
            <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
              <div className="col-span-2 md:col-span-2">
                <EditableField
                  value={job.scheduled_date}
                  onSave={(val) => handleFieldSave('scheduled_date', job.scheduled_date, val)}
                  type="date"
                  icon={Calendar}
                  displayFormat={(val) => format(parseISO(val), 'MMM d')}
                  placeholder="Set date"
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <EditableField
                  value={job.scheduled_time}
                  onSave={(val) => handleFieldSave('scheduled_time', job.scheduled_time, val)}
                  type="time"
                  icon={Clock}
                  placeholder="Set time"
                />
              </div>
              <div className="col-span-2 md:col-span-3">
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
                  className={`text-xs font-semibold ${job.product ? productColors[job.product] : ""}`}
                  placeholder="Product"
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <EditableField
                  value={job.job_type_id}
                  onSave={handleJobTypeChange}
                  type="select"
                  icon={Briefcase}
                  options={jobTypes.map((jt) => ({ value: jt.id, label: jt.name }))}
                  displayFormat={(val) => jobTypes.find((jt) => jt.id === val)?.name || val}
                  placeholder="Job type"
                  className="text-xs font-semibold bg-purple-50 text-purple-700 border-purple-200"
                />
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">Technicians</span>
                </div>
                <div className="flex items-center gap-1">
                  {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : job.assigned_to_name ? [job.assigned_to_name] : []).slice(0, 3).map((name, idx) => (
                    <div
                      key={idx}
                      className={`${getAvatarColor(name)} w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                      title={name}
                    >
                      {getInitials(name)}
                    </div>
                  ))}
                  {Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 3 && (
                    <div className="bg-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-slate-700 text-xs font-bold shadow-sm">
                      +{job.assigned_to_name.length - 3}
                    </div>
                  )}
                  <EditableField
                    value={Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : []}
                    onSave={handleAssignedToChange}
                    type="multi-select"
                    icon={User}
                    options={technicians.map((t) => ({ value: t.email, label: t.full_name }))}
                    displayFormat={(val) => {
                      const emailsToDisplay = Array.isArray(val) ? val : val ? [val] : [];
                      return emailsToDisplay.length === 0 ? "Assign" : "Edit";
                    }}
                    placeholder="Assign"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-2">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-2 h-9">
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="visit" className="text-xs">
                <ClipboardCheck className="w-3 h-3 md:mr-1" />
                <span className="hidden md:inline">Visit</span>
              </TabsTrigger>
              <TabsTrigger value="form" className="text-xs">
                <FileCheck className="w-3 h-3 md:mr-1" />
                <span className="hidden md:inline">Form</span>
              </TabsTrigger>
            <TabsTrigger value="files" className="text-xs">
                <ImageIcon className="w-3 h-3 md:mr-1" />
                <span className="hidden md:inline">Files</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-3 mt-2">
              <div className="border-t pt-2">
                <h3 className="text-xs font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  Notes
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <RichTextEditor
                    value={notes}
                    onChange={setNotes}
                    onBlur={handleNotesBlur}
                    placeholder="Add notes..."
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1.5">Pricing</h3>
                <Input
                  value={pricingProvided}
                  onChange={(e) => setPricingProvided(e.target.value)}
                  onBlur={handlePricingProvidedBlur}
                  placeholder="Enter pricing..."
                  className="text-xs h-8 bg-slate-50"
                />
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1.5">Additional Info</h3>
                <RichTextEditor
                  value={additionalInfo}
                  onChange={setAdditionalInfo}
                  onBlur={handleAdditionalInfoBlur}
                  placeholder="Add info..."
                />
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t">
                {!activeCheckIn ? (
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkInMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-9"
                  >
                    <LogIn className="w-3.5 h-3.5 mr-1.5" />
                    {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                  </Button>
                ) : (
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-2">
                    <div className="flex items-center gap-1.5 text-blue-700">
                      <Timer className="w-4 h-4" />
                      <span className="text-xs font-semibold">
                        Checked in at {format(new Date(activeCheckIn.check_in_time), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                )}
                {totalJobTime > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Total Time:</span>
                      <span className="text-xs font-semibold text-slate-900">{totalJobTime.toFixed(1)}h</span>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="visit" className="space-y-3 mt-2">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold mb-1">Overview *</Label>
                  <RichTextEditor
                    value={overview}
                    onChange={setOverview}
                    onBlur={handleOverviewBlur}
                    placeholder="Overview..."
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1">Next Steps *</Label>
                  <RichTextEditor
                    value={nextSteps}
                    onChange={setNextSteps}
                    onBlur={handleNextStepsBlur}
                    placeholder="Next steps..."
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1">Communication *</Label>
                  <RichTextEditor
                    value={communicationWithClient}
                    onChange={setCommunicationWithClient}
                    onBlur={handleCommunicationBlur}
                    placeholder="Communication notes..."
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1">Outcome *</Label>
                  <Select value={outcome} onValueChange={handleOutcomeChange}>
                    <SelectTrigger className="h-9 text-xs">
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

                {validationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-red-700">{validationError}</span>
                  </div>
                )}

                {activeCheckIn && (
                  <div className="pt-2 border-t">
                    <Button
                      onClick={handleCheckOut}
                      disabled={checkOutMutation.isPending}
                      className="w-full bg-orange-600 hover:bg-orange-700 h-9"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-1.5" />
                      {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                    </Button>
                  </div>
                )}

                {completedCheckIns.length > 0 && (
                  <Collapsible defaultOpen={false} className="pt-2 border-t">
                    <CollapsibleTrigger className="flex items-center justify-between w-full group">
                      <h4 className="text-xs font-semibold text-slate-900">Time Tracking ({completedCheckIns.length})</h4>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="pt-2 space-y-2">
                      {completedCheckIns.map((checkIn, index) => (
                        <div key={checkIn.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Visit {completedCheckIns.length - index}</span>
                              <span className="font-medium text-slate-700">{checkIn.technician_name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              <div>
                                <span className="text-slate-500">In:</span>
                                <div className="font-medium text-slate-900">
                                  {format(new Date(checkIn.check_in_time), 'MMM d, h:mm a')}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500">Out:</span>
                                <div className="font-medium text-slate-900">
                                  {format(new Date(checkIn.check_out_time), 'MMM d, h:mm a')}
                                </div>
                              </div>
                            </div>
                            <div className="pt-1.5 border-t border-slate-300">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600">Duration:</span>
                                <span className="font-semibold text-slate-900">
                                  {checkIn.duration_hours.toFixed(1)}h
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-900">Total:</span>
                          <span className="text-sm font-bold text-blue-900">{totalJobTime.toFixed(1)}h</span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </TabsContent>

            <TabsContent value="form" className="mt-2">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-900">Measurements</h3>
                <MeasurementsForm
                  measurements={measurements}
                  onChange={handleMeasurementsChange}
                />
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-2">
              <div className="space-y-3">
                <EditableFileUpload
                  files={job.image_urls || []}
                  onFilesChange={handleImagesChange}
                  accept="image/*,video/*"
                  multiple={true}
                  icon={ImageIcon}
                  label="Photos & Videos"
                  emptyText="Upload media"
                />

                <div className="grid md:grid-cols-2 gap-2 pt-2 border-t">
                  <EditableFileUpload
                    files={job.quote_url}
                    onFilesChange={handleQuoteChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Quote"
                    emptyText="Upload quote"
                  />

                  <EditableFileUpload
                    files={job.invoice_url}
                    onFilesChange={handleInvoiceChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Invoice"
                    emptyText="Upload invoice"
                  />
                </div>
              </div>
            </TabsContent>
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

      <CustomerEditModal
        customer={customer}
        open={showCustomerEdit}
        onClose={() => setShowCustomerEdit(false)}
        onSubmit={handleCustomerSubmit}
        isSubmitting={updateCustomerMutation.isPending}
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
