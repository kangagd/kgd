import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Phone, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, DollarSign, Sparkles, LogIn, FileCheck, History, Package, ClipboardCheck, LogOut, Timer, AlertCircle, ChevronDown, Mail, Navigation, Trash2, FolderKanban, Camera, Edit } from "lucide-react";
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
import { determineJobStatus } from "./jobStatusHelper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";

const statusColors = {
  open: "bg-slate-100 text-slate-800 border-slate-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  quoted: "bg-purple-100 text-purple-800 border-purple-200",
  invoiced: "bg-indigo-100 text-indigo-800 border-indigo-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  lost: "bg-red-100 text-red-800 border-red-200"
};

const stageColors = {
  lead: "bg-slate-100 text-slate-800 border-slate-200",
  assessment_measure: "bg-yellow-100 text-yellow-800 border-yellow-200",
  quote_preparing: "bg-orange-100 text-orange-800 border-orange-200",
  quote_sent: "bg-purple-100 text-purple-800 border-purple-200",
  quote_approved: "bg-indigo-100 text-indigo-800 border-indigo-200",
  parts_ordered: "bg-blue-100 text-blue-800 border-blue-200",
  scheduled: "bg-cyan-100 text-cyan-800 border-cyan-200",
  technician_on_site: "bg-orange-100 text-orange-800 border-orange-200",
  return_visit_needed: "bg-amber-100 text-amber-800 border-amber-200",
  work_completed: "bg-lime-100 text-lime-800 border-lime-200",
  invoiced: "bg-indigo-100 text-indigo-800 border-indigo-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  lost: "bg-red-100 text-red-800 border-red-200"
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
  "Strata - Owner": "bg-amber-100 text-amber-700"
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.
  split(" ").
  map((n) => n[0]).
  join("").
  toUpperCase().
  slice(0, 2);
};

const avatarColors = [
"bg-blue-500",
"bg-purple-500",
"bg-green-500",
"bg-orange-500",
"bg-pink-500",
"bg-indigo-500",
"bg-red-500",
"bg-teal-500"];


const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export default function JobDetails({ job, onClose, onStatusChange, onDelete }) {
  const [showPriceList, setShowPriceList] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomerEdit, setShowCustomerEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const { data: jobSummaries = [] } = useQuery({
    queryKey: ['jobSummaries', job.id],
    queryFn: () => base44.entities.JobSummary.filter({ job_id: job.id }, '-checkout_time')
  });

  const { data: allProjectJobs = [] } = useQuery({
    queryKey: ['projectJobs', job.project_id],
    queryFn: () => base44.entities.Job.filter({ project_id: job.project_id }),
    enabled: !!job.project_id
  });

  const projectJobs = allProjectJobs.filter((j) => j.id !== job.id && !j.deleted_at);

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

      // Update status based on date and check-in
      const newStatus = determineJobStatus(job.scheduled_date, job.outcome, true, job.status);
      await base44.entities.Job.update(job.id, { status: newStatus });

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

      await base44.entities.JobSummary.create({
        job_id: job.id,
        job_number: job.job_number,
        technician_email: user.email,
        technician_name: user.full_name,
        checkout_time: checkOutTime,
        overview,
        next_steps: nextSteps,
        communication_with_client: communicationWithClient,
        outcome
      });

      await base44.entities.CheckInOut.update(activeCheckIn.id, {
        check_out_time: checkOutTime,
        duration_hours: Math.round(durationHours * 10) / 10
      });

      await base44.entities.Job.update(job.id, {
        overview: "",
        next_steps: "",
        communication_with_client: "",
        outcome: ""
      });

      // Update status after checkout - no longer has active check-in
      const newStatus = determineJobStatus(job.scheduled_date, outcome, false, job.status);
      await base44.entities.Job.update(job.id, { status: newStatus });
    },
    onSuccess: () => {
      setValidationError("");
      setOverview("");
      setNextSteps("");
      setCommunicationWithClient("");
      setOutcome("");
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobSummaries', job.id] });
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

    // Update status based on centralized logic - check if there's an active check-in
    const newStatus = determineJobStatus(job.scheduled_date, value, !!activeCheckIn, job.status);
    if (newStatus !== job.status) {
      updateJobMutation.mutate({ field: 'status', value: newStatus });
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
    logChange('job_type_id', job.job_type_id, jobTypeId);
    updateJobMutation.mutate({
      field: 'job_type_id',
      value: jobTypeId
    });
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

  const handleDeleteClick = () => {
    console.log('Delete clicked for job:', job.id, job.job_number);
    onDelete(job.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Card className={`border border-[#E5E7EB] shadow-sm ${isTechnician ? 'rounded-none' : 'rounded-lg'} overflow-hidden`}>
        <CardHeader className="border-b border-[#E5E7EB] bg-white p-3 md:p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 flex-shrink-0 hover:bg-[#F3F4F6] rounded-lg transition-colors">

                <ArrowLeft className="w-5 h-5 text-[#111827]" />
              </Button>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle
                    className="text-xl font-semibold text-[#111827] cursor-pointer hover:text-[#FAE008] transition-colors leading-tight"
                    onClick={() => setShowCustomerEdit(true)}>
                    {job.customer_name}
                  </CardTitle>
                  <Badge className="bg-white text-[#6B7280] hover:bg-white border border-[#E5E7EB] font-medium text-xs px-2.5 py-0.5 rounded-lg">
                    #{job.job_number}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {job.customer_type &&
                  <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-xs px-3 py-1 rounded-lg">
                      {job.customer_type}
                    </Badge>
                  }
                </div>
                
                <div className="flex items-start gap-2">
                  <MapPin className="text-[#4B5563] w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[#4B5563] leading-snug">{job.address}</span>
                </div>
              </div>
            </div>
            
            {!isTechnician &&
            <div className="flex gap-1 flex-shrink-0">
                <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg"
                title="Delete">

                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(true)}
                className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
                title="History">

                  <History className="w-4 h-4" />
                </Button>
                <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPriceList(true)}
                className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
                title="Price List">

                  <DollarSign className="w-4 h-4" />
                </Button>
                <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAssistant(true)}
                className="h-9 w-9 hover:bg-[#FAE008]/10 text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
                title="AI Assistant">

                  <Sparkles className="w-4 h-4" />
                </Button>
              </div>
            }
          </div>

          <div className="bg-[#ffffff] p-4 rounded-lg space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-[#4B5563]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Date</div>
                  <EditableField
                    value={job.scheduled_date}
                    onSave={(val) => handleFieldSave('scheduled_date', job.scheduled_date, val)}
                    type="date"
                    displayFormat={(val) => format(parseISO(val), 'MMM d, yyyy')}
                    placeholder="Set date"
                    className="font-semibold text-[#111827] text-sm" />

                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-[#4B5563]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Time</div>
                  <EditableField
                    value={job.scheduled_time}
                    onSave={(val) => handleFieldSave('scheduled_time', job.scheduled_time, val)}
                    type="time"
                    placeholder="Time"
                    className="font-semibold text-[#111827] text-sm" />

                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-[#4B5563]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Product</div>
                  <EditableField
                    value={job.product}
                    onSave={(val) => handleFieldSave('product', job.product, val)}
                    type="select"
                    options={[
                    { value: "Garage Door", label: "Garage Door" },
                    { value: "Gate", label: "Gate" },
                    { value: "Roller Shutter", label: "Roller Shutter" },
                    { value: "Multiple", label: "Multiple" },
                    { value: "Custom Garage Door", label: "Custom Garage Door" }]
                    }
                    className="font-semibold text-[#111827] text-sm"
                    placeholder="Product" />

                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-5 h-5 text-[#4B5563]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Job Type</div>
                  <EditableField
                    value={job.job_type_id}
                    onSave={handleJobTypeChange}
                    type="select"
                    options={jobTypes.map((jt) => ({ value: jt.id, label: jt.name }))}
                    displayFormat={(val) => jobTypes.find((jt) => jt.id === val)?.name || val}
                    placeholder="Job type"
                    className="font-semibold text-[#111827] text-sm" />

                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E7EB] pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-[#4B5563]" />
                <span className="text-xs font-medium text-[#4B5563]">Technicians</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : job.assigned_to_name ? [job.assigned_to_name] : []).slice(0, 3).map((name, idx) =>
                <div
                  key={idx}
                  className={`${getAvatarColor(name)} w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                  title={name}>

                    {getInitials(name)}
                  </div>
                )}
                {Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 3 &&
                <div className="bg-[#6B7280] w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    +{job.assigned_to_name.length - 3}
                  </div>
                }
                <EditableField
                  value={Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : []}
                  onSave={handleAssignedToChange}
                  type="multi-select"
                  icon={Edit}
                  options={technicians.map((t) => ({ value: t.email, label: t.full_name }))}
                  displayFormat={(val) => {
                    const emailsToDisplay = Array.isArray(val) ? val : val ? [val] : [];
                    return emailsToDisplay.length === 0 ? "Assign" : "Edit";
                  }}
                  placeholder="Assign" />

              </div>
            </div>
          </div>
        </CardHeader>

        {/* Technician Quick Actions */}
        {isTechnician &&
        <div className={`bg-white border-b border-[#E5E7EB] p-3 ${isTechnician ? 'sticky top-0 z-20 shadow-sm' : ''}`}>
            <div className="grid grid-cols-4 gap-2">
              {job.customer_phone &&
            <Button
              variant="outline"
              onClick={() => window.location.href = `tel:${job.customer_phone}`}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-blue-50 hover:border-blue-200 transition-all rounded-lg">

                  <Phone className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-semibold text-[#111827]">Call</span>
                </Button>
            }
              <Button
              variant="outline"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-green-50 hover:border-green-200 transition-all rounded-lg">

                <Navigation className="w-5 h-5 text-green-600" />
                <span className="text-xs font-semibold text-[#111827]">Navigate</span>
              </Button>
              {!activeCheckIn ?
            <Button
              onClick={handleCheckIn}
              disabled={checkInMutation.isPending}
              className="flex flex-col items-center gap-1 h-auto py-3 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold rounded-lg">

                  <LogIn className="w-5 h-5" />
                  <span className="text-xs">Check In</span>
                </Button> :

            <Button
              onClick={handleCheckOut}
              disabled={checkOutMutation.isPending}
              className="flex flex-col items-center gap-1 h-auto py-3 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold rounded-lg">

                  <LogOut className="w-5 h-5" />
                  <span className="text-xs">Check Out</span>
                </Button>
            }
              <Button
              variant="outline"
              onClick={() => setShowPriceList(true)}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-purple-50 hover:border-purple-200 transition-all rounded-lg">

                <DollarSign className="w-5 h-5 text-purple-600" />
                <span className="text-xs font-semibold text-[#111827]">Price</span>
              </Button>
            </div>
          </div>
        }
        
        <CardContent className="p-3 md:p-4 space-y-3">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-11 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-1">
              <TabsTrigger value="details" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Details</TabsTrigger>
              <TabsTrigger value="visit" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ClipboardCheck className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Visit</span>
              </TabsTrigger>
              <TabsTrigger value="form" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <FileCheck className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Form</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ImageIcon className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Files</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-3 mt-3">
              {job.project_id && projectJobs.length > 0 &&
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4" />
                    Project Job History ({projectJobs.length})
                  </h3>
                  <div className="space-y-2">
                    {projectJobs.map((pJob) =>
                  <div key={pJob.id} className="bg-white border border-blue-200 rounded-lg p-2.5 text-sm">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex-1">
                            <div className="font-bold text-slate-900">
                              {pJob.job_type_name || 'Job'} #{pJob.job_number}
                            </div>
                            {pJob.scheduled_date &&
                        <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                {format(parseISO(pJob.scheduled_date), 'MMM d, yyyy')}
                              </div>
                        }
                          </div>
                          {pJob.status &&
                      <Badge className={`${statusColors[pJob.status]} text-xs font-semibold border`}>
                              {pJob.status.replace(/_/g, ' ')}
                            </Badge>
                      }
                        </div>
                        {pJob.notes && pJob.notes !== "<p><br></p>" && // Check for empty RichTextEditor content
                    <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-blue-100">
                            <div className="font-semibold mb-0.5">Notes:</div>
                            <div className="line-clamp-2" dangerouslySetInnerHTML={{ __html: pJob.notes }} />
                          </div>
                    }
                        {pJob.outcome &&
                    <Badge className={`${outcomeColors[pJob.outcome]} text-xs font-semibold border mt-1.5`}>
                            Outcome: {pJob.outcome.replace(/_/g, ' ')}
                          </Badge>
                    }
                      </div>
                  )}
                  </div>
                </div>
              }

              <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
                <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <h3 className="text-sm font-bold text-[#111827]">Notes</h3>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <RichTextEditor
                    value={notes}
                    onChange={setNotes}
                    onBlur={handleNotesBlur}
                    placeholder="Add notes..." />

                </CardContent>
              </Card>

              <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
                <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#6B7280]" />
                    <h3 className="text-sm font-bold text-[#111827]">Pricing</h3>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <Input
                    value={pricingProvided}
                    onChange={(e) => setPricingProvided(e.target.value)}
                    onBlur={handlePricingProvidedBlur}
                    placeholder="Enter pricing..."
                    className="text-sm h-10 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 rounded-lg" />

                </CardContent>
              </Card>

              <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
                <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <h3 className="text-sm font-bold text-[#111827]">Additional Info</h3>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <RichTextEditor
                    value={additionalInfo}
                    onChange={setAdditionalInfo}
                    onBlur={handleAdditionalInfoBlur}
                    placeholder="Add additional information..." />

                </CardContent>
              </Card>

              {!isTechnician &&
              <div className="flex flex-col gap-2">
                  {!activeCheckIn ?
                <Button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] h-11 font-semibold text-base rounded-lg shadow-sm hover:shadow-md transition-all">

                      <LogIn className="w-5 h-5 mr-2" />
                      {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                    </Button> :

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Timer className="w-4 h-4" />
                        <span className="text-sm font-semibold">
                          Checked in at {format(new Date(activeCheckIn.check_in_time), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                }
                  {totalJobTime > 0 &&
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#6B7280] font-semibold">Total Time:</span>
                        <span className="text-sm font-bold text-[#111827]">{totalJobTime.toFixed(1)}h</span>
                      </div>
                    </div>
                }
                </div>
              }

              {jobSummaries.length > 0 &&
              <Collapsible defaultOpen={true} className="pt-3 border-t-2">
                  <CollapsibleTrigger className="flex items-center justify-between w-full group bg-slate-50 border-2 border-slate-200 rounded-xl p-3 hover:bg-slate-100 transition-colors">
                    <h4 className="text-sm font-bold text-[#000000]">Previous Visit Summaries ({jobSummaries.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-3 space-y-3">
                    {jobSummaries.map((summary) =>
                  <div key={summary.id} className="bg-white border-2 border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-[#000000]">{summary.technician_name}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {format(new Date(summary.checkout_time), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        
                        {summary.outcome &&
                    <Badge className={`${outcomeColors[summary.outcome]} mb-3 font-semibold border-2`}>
                            {summary.outcome.replace(/_/g, ' ')}
                          </Badge>
                    }

                        <div className="space-y-2">
                          {summary.overview &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Overview:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                            </div>
                      }
                          
                          {summary.next_steps &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Next Steps:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                            </div>
                      }
                          
                          {summary.communication_with_client &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Communication:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.communication_with_client }} />
                            </div>
                      }
                        </div>
                      </div>
                  )}
                  </CollapsibleContent>
                </Collapsible>
              }
            </TabsContent>

            <TabsContent value="visit" className="space-y-3 mt-2">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-bold text-[#000000] mb-1.5 block">Overview *</Label>
                  <div className="border-2 border-slate-300 rounded-xl p-2.5 focus-within:border-[#fae008] focus-within:ring-2 focus-within:ring-[#fae008]/20 transition-all">
                    <RichTextEditor
                      value={overview}
                      onChange={setOverview}
                      onBlur={handleOverviewBlur}
                      placeholder="Overview..." />

                  </div>
                </div>

                <div>
                  <Label className="text-sm font-bold text-[#000000] mb-1.5 block">Next Steps *</Label>
                  <div className="border-2 border-slate-300 rounded-xl p-2.5 focus-within:border-[#fae008] focus-within:ring-2 focus-within:ring-[#fae008]/20 transition-all">
                    <RichTextEditor
                      value={nextSteps}
                      onChange={setNextSteps}
                      onBlur={handleNextStepsBlur}
                      placeholder="Next steps..." />

                  </div>
                </div>

                <div>
                  <Label className="text-sm font-bold text-[#000000] mb-1.5 block">Communication *</Label>
                  <div className="border-2 border-slate-300 rounded-xl p-2.5 focus-within:border-[#fae008] focus-within:ring-2 focus-within:ring-[#fae008]/20 transition-all">
                    <RichTextEditor
                      value={communicationWithClient}
                      onChange={setCommunicationWithClient}
                      onBlur={handleCommunicationBlur}
                      placeholder="Communication notes..." />

                  </div>
                </div>

                <div>
                  <Label className="text-sm font-bold text-[#000000] mb-1.5 block">Outcome *</Label>
                  <Select value={outcome} onValueChange={handleOutcomeChange}>
                    <SelectTrigger className="h-11 text-sm border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 rounded-xl font-medium">
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
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-2.5 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-700 font-medium">{validationError}</span>
                  </div>
                }

                {activeCheckIn &&
                <div className="pt-3 border-t-2">
                    <Button
                    onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-11 font-semibold text-base rounded-xl shadow-md hover:shadow-lg transition-all">

                      <LogOut className="w-4 h-4 mr-2" />
                      {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                    </Button>
                  </div>
                }
              </div>

              {completedCheckIns.length > 0 &&
              <Collapsible defaultOpen={false} className="pt-3 border-t-2">
                  <CollapsibleTrigger className="flex items-center justify-between w-full group bg-slate-50 border-2 border-slate-200 rounded-xl p-3 hover:bg-slate-100 transition-colors">
                    <h4 className="text-sm font-bold text-[#000000]">Time Tracking ({completedCheckIns.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-2.5 space-y-2.5">
                    {completedCheckIns.map((checkIn, index) =>
                  <div key={checkIn.id} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-2.5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-medium">Visit {completedCheckIns.length - index}</span>
                            <span className="font-bold text-[#000000]">{checkIn.technician_name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                            <div>
                              <span className="text-slate-500 font-medium">In:</span>
                              <div className="font-bold text-[#000000]">
                                {format(new Date(checkIn.check_in_time), 'MMM d, h:mm a')}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500 font-medium">Out:</span>
                              <div className="font-bold text-[#000000]">
                                {format(new Date(checkIn.check_out_time), 'MMM d, h:mm a')}
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 border-t-2 border-slate-300">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600 font-semibold">Duration:</span>
                              <span className="font-bold text-[#000000]">
                                {checkIn.duration_hours.toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                  )}

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-900">Total:</span>
                        <span className="text-base font-bold text-blue-900">{totalJobTime.toFixed(1)}h</span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              }

              {jobSummaries.length > 0 &&
              <Collapsible defaultOpen={false} className="pt-3 border-t-2">
                  <CollapsibleTrigger className="flex items-center justify-between w-full group bg-slate-50 border-2 border-slate-200 rounded-xl p-3 hover:bg-slate-100 transition-colors">
                    <h4 className="text-sm font-bold text-[#000000]">Previous Visit Summaries ({jobSummaries.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-3 space-y-3">
                    {jobSummaries.map((summary) =>
                  <div key={summary.id} className="bg-white border-2 border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-[#000000]">{summary.technician_name}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {format(new Date(summary.checkout_time), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        
                        {summary.outcome &&
                    <Badge className={`${outcomeColors[summary.outcome]} mb-3 font-semibold border-2`}>
                            {summary.outcome.replace(/_/g, ' ')}
                          </Badge>
                    }

                        <div className="space-y-2">
                          {summary.overview &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Overview:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                            </div>
                      }
                          
                          {summary.next_steps &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Next Steps:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                            </div>
                      }
                          
                          {summary.communication_with_client &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Communication:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.communication_with_client }} />
                            </div>
                      }
                        </div>
                      </div>
                  )}
                  </CollapsibleContent>
                </Collapsible>
              }
            </TabsContent>

            <TabsContent value="form" className="mt-2">
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-[#000000]">Measurements</h3>
                <MeasurementsForm
                  measurements={measurements}
                  onChange={handleMeasurementsChange} />

              </div>

              {jobSummaries.length > 0 &&
              <Collapsible defaultOpen={true} className="pt-3 border-t-2 mt-3">
                  <CollapsibleTrigger className="flex items-center justify-between w-full group bg-slate-50 border-2 border-slate-200 rounded-xl p-3 hover:bg-slate-100 transition-colors">
                    <h4 className="text-sm font-bold text-[#000000]">Previous Visit Summaries ({jobSummaries.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-3 space-y-3">
                    {jobSummaries.map((summary) =>
                  <div key={summary.id} className="bg-white border-2 border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-[#000000]">{summary.technician_name}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {format(new Date(summary.checkout_time), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        
                        {summary.outcome &&
                    <Badge className={`${outcomeColors[summary.outcome]} mb-3 font-semibold border-2`}>
                            {summary.outcome.replace(/_/g, ' ')}
                          </Badge>
                    }

                        <div className="space-y-2">
                          {summary.overview &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Overview:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                            </div>
                      }
                          
                          {summary.next_steps &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Next Steps:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                            </div>
                      }
                          
                          {summary.communication_with_client &&
                      <div>
                              <div className="text-xs font-bold text-slate-500 mb-1">Communication:</div>
                              <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: summary.communication_with_client }} />
                            </div>
                      }
                        </div>
                      </div>
                  )}
                  </CollapsibleContent>
                </Collapsible>
              }
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
                  emptyText="Upload media" />


                <div className="grid md:grid-cols-2 gap-2.5 pt-3 border-t-2">
                  <EditableFileUpload
                    files={job.quote_url}
                    onFilesChange={handleQuoteChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Quote"
                    emptyText="Upload quote" />


                  <EditableFileUpload
                    files={job.invoice_url}
                    onFilesChange={handleInvoiceChange}
                    accept=".pdf,.doc,.docx"
                    multiple={false}
                    icon={FileText}
                    label="Invoice"
                    emptyText="Upload invoice" />

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


      <CustomerEditModal
        customer={customer}
        open={showCustomerEdit}
        onClose={() => setShowCustomerEdit(false)}
        onSubmit={handleCustomerSubmit}
        isSubmitting={updateCustomerMutation.isPending} />


      {!isTechnician &&
      <TechnicianAssistant
        open={showAssistant}
        onClose={() => setShowAssistant(false)}
        job={job} />

      }

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-[#000000]">Delete Job?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This job will be moved to the archive. You can restore it within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClick}
              className="bg-red-600 hover:bg-red-700 rounded-xl font-semibold">

              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);

}