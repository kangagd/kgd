import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin, Phone, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, DollarSign, Sparkles, LogIn, FileCheck, History, Package, ClipboardCheck, LogOut, Timer, AlertCircle, ChevronDown, ChevronRight, Mail, Navigation, Trash2, FolderKanban, CheckSquare, Paperclip, Ruler, Upload, X, Eye, Download, MoreVertical } from "lucide-react";
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
import { determineJobStatus, shouldAutoSchedule, getStatusChangeMessage } from "./jobStatusHelper";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const statusColors = {
  open: "rgba(37, 99, 235, 0.15)",
  scheduled: "rgba(14, 165, 233, 0.15)",
  in_progress: "rgba(14, 165, 233, 0.15)",
  quoted: "rgba(124, 58, 237, 0.15)",
  invoiced: "rgba(249, 115, 22, 0.15)",
  paid: "rgba(22, 163, 74, 0.15)",
  completed: "rgba(21, 128, 61, 0.15)",
  cancelled: "rgba(220, 38, 38, 0.15)"
};

const statusTextColors = {
  open: "#2563EB",
  scheduled: "#0EA5E9",
  in_progress: "#0EA5E9",
  quoted: "#7C3AED",
  invoiced: "#F97316",
  paid: "#16A34A",
  completed: "#15803D",
  cancelled: "#DC2626"
};

const productColors = {
  "Garage Door": "bg-[#FEF8C8] text-slate-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700"
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-[#FEF8C8] text-slate-800 border-slate-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200"
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
  "bg-[#FCEE7B]",
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

export default function JobDetails({ job, onClose, onDelete }) {
  const [activeTab, setActiveTab] = useState("summary");
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
  const [initialImageCount, setInitialImageCount] = useState(0);
  const [quoteCaption, setQuoteCaption] = useState(job.quote_caption || "");
  const [invoiceCaption, setInvoiceCaption] = useState(job.invoice_caption || "");
  const [otherDocuments, setOtherDocuments] = useState(job.other_documents || []);
  const [uploadingOther, setUploadingOther] = useState(false);
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

  const projectJobs = allProjectJobs.filter(j => j.id !== job.id && !j.deleted_at);

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
      
      setInitialImageCount((job.image_urls || []).length);
      const newStatus = 'in_progress';
      await base44.entities.Job.update(job.id, { status: newStatus });
      
      if (job.status !== newStatus) {
        toast.success(getStatusChangeMessage(job.status, newStatus, job.job_number, job.customer_name));
      }
      
      return checkIn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const missingFields = [];
      if (!overview || overview === "<p><br></p>") missingFields.push("Overview");
      if (!nextSteps || nextSteps === "<p><br></p>") missingFields.push("Next Steps");
      if (!communicationWithClient || communicationWithClient === "<p><br></p>") missingFields.push("Communication");
      if (!outcome) missingFields.push("Outcome");

      if (missingFields.length > 0) {
        throw new Error(`Required fields missing: ${missingFields.join(", ")}`);
      }

      const currentImageCount = (job.image_urls || []).length;
      if (currentImageCount === initialImageCount) {
        throw new Error("Please add at least one photo before checking out");
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
      
      const newStatus = determineJobStatus(job.scheduled_date, outcome, false, job.status);
      if (newStatus !== job.status) {
        await base44.entities.Job.update(job.id, { status: newStatus });
        toast.success(getStatusChangeMessage(job.status, newStatus, job.job_number, job.customer_name));
      }
    },
    onSuccess: () => {
      setValidationError("");
      setOverview("");
      setNextSteps("");
      setCommunicationWithClient("");
      setOutcome("");
      setInitialImageCount(0);
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobSummaries', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => {
      setValidationError(error.message);
      toast.error(error.message);
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

  const handleFieldSave = async (fieldName, oldValue, newValue) => {
    logChange(fieldName, oldValue, newValue);
    
    // Check if we need to auto-update status based on scheduling
    if ((fieldName === 'scheduled_date' || fieldName === 'scheduled_time') && 
        shouldAutoSchedule(
          fieldName === 'scheduled_date' ? newValue : job.scheduled_date,
          fieldName === 'scheduled_time' ? newValue : job.scheduled_time
        ) && 
        job.status === 'open') {
      const newStatus = 'scheduled';
      await base44.entities.Job.update(job.id, { 
        [fieldName]: newValue,
        status: newStatus
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      if (job.status !== newStatus) { // Check if status actually changed
        toast.success(getStatusChangeMessage(job.status, newStatus, job.job_number, job.customer_name));
      }
    } else {
      updateJobMutation.mutate({ field: fieldName, value: newValue });
    }
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
    
    const newStatus = determineJobStatus(job.scheduled_date, value, !!activeCheckIn, job.status);
    if (newStatus !== job.status) {
      updateJobMutation.mutate({ field: 'status', value: newStatus });
      toast.info(`Job will be marked as ${newStatus.replace(/_/g, ' ')} upon checkout`);
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

  const handleJobTypeChange = async (jobTypeId) => {
    const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
    logChange('job_type_id', job.job_type_id, jobTypeId);
    
    const updateData = { job_type_id: jobTypeId };
    if (jobType) {
      updateData.job_type_name = jobType.name;
    }
    
    await base44.entities.Job.update(job.id, updateData);
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
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

  const handleQuoteCaptionBlur = () => {
    if (quoteCaption !== job.quote_caption) {
      updateJobMutation.mutate({ field: 'quote_caption', value: quoteCaption });
    }
  };

  const handleInvoiceCaptionBlur = () => {
    if (invoiceCaption !== job.invoice_caption) {
      updateJobMutation.mutate({ field: 'invoice_caption', value: invoiceCaption });
    }
  };

  const handleOtherDocumentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingOther(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const newDocs = results.map(result => ({
        url: result.file_url,
        caption: ""
      }));
      
      const updatedDocs = [...otherDocuments, ...newDocs];
      setOtherDocuments(updatedDocs);
      updateJobMutation.mutate({ field: 'other_documents', value: updatedDocs });
    } catch (error) {
      console.error("Error uploading files:", error);
    }
    setUploadingOther(false);
    e.target.value = '';
  };

  const handleOtherDocumentCaptionChange = (index, caption) => {
    const updatedDocs = [...otherDocuments];
    updatedDocs[index].caption = caption;
    setOtherDocuments(updatedDocs);
  };

  const handleOtherDocumentCaptionBlur = (index) => {
    updateJobMutation.mutate({ field: 'other_documents', value: otherDocuments });
  };

  const handleRemoveOtherDocument = (index) => {
    const updatedDocs = otherDocuments.filter((_, i) => i !== index);
    setOtherDocuments(updatedDocs);
    updateJobMutation.mutate({ field: 'other_documents', value: updatedDocs });
  };

  const handleCustomerSubmit = (data) => {
    updateCustomerMutation.mutate({ id: job.customer_id, data });
  };

  const handleDeleteClick = () => {
    onDelete(job.id);
    setShowDeleteConfirm(false);
  };

  const tabs = [
    { id: "summary", label: "Summary", icon: ClipboardCheck },
    { id: "sitevisit", label: "Site Visit", icon: CheckSquare },
    { id: "photos", label: "Photos", icon: ImageIcon },
    { id: "measurements", label: "Measurements", icon: Ruler },
    { id: "attachments", label: "Attachments", icon: Paperclip },
    { id: "audit", label: "Audit", icon: History },
  ];

  return (
    <>
      <div className="min-h-screen bg-[#F8F9FA]">
        {/* Sticky Header */}
        <div className="bg-white border-b-2 border-[#E5E7EB] sticky top-0 z-10 shadow-md">
          <div className="p-3 md:p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 
                    className="text-base md:text-xl font-bold text-[#111827] mb-1 cursor-pointer hover:text-[#FAE008] transition-colors truncate"
                    onClick={() => setShowCustomerEdit(true)}
                  >
                    {job.customer_name}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs md:text-sm text-[#4B5563] font-semibold">Job #{job.job_number}</span>
                    {job.scheduled_date && (
                      <div className="flex items-center gap-1 text-xs md:text-sm text-[#4B5563]">
                        <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                        {format(parseISO(job.scheduled_date), 'MMM d')}
                        {job.scheduled_time && ` at ${job.scheduled_time}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className="status-chip capitalize whitespace-nowrap">
                  {job.status.replace(/_/g, ' ')}
                </Badge>
                {!isTechnician && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0 hover:bg-gray-100 rounded-lg">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setShowPriceList(true)}>
                        <DollarSign className="w-4 h-4 mr-2" />
                        Price List
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowHistory(true)}>
                        <History className="w-4 h-4 mr-2" />
                        History
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowAssistant(true)}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Assistant
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Primary Actions for Technicians */}
            {isTechnician && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E5E7EB]">
                {job.customer_phone && (
                  <Button
                    size="lg"
                    onClick={() => window.location.href = `tel:${job.customer_phone}`}
                    className="btn-primary h-12 w-full font-semibold"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call
                  </Button>
                )}
                <Button
                  size="lg"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold h-12 w-full"
                >
                  <Navigation className="w-5 h-5 mr-2" />
                  Navigate
                </Button>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex overflow-x-auto px-2 md:px-4 gap-0.5 no-scrollbar bg-[#F8F9FA]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 rounded-t-lg ${
                  activeTab === tab.id
                    ? 'bg-white text-[#111827] border-b-2 border-[#FAE008]'
                    : 'text-[#4B5563] hover:text-[#111827] hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4 pb-24 max-w-7xl mx-auto">
          {activeTab === "summary" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Job Details Card */}
                <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide">Job Details</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-medium text-[#4B5563] mb-2">Customer</div>
                        <div 
                          className="text-base font-semibold text-[#111827] cursor-pointer hover:text-[#FAE008] transition-colors"
                          onClick={() => setShowCustomerEdit(true)}
                        >
                          {job.customer_name}
                        </div>
                      </div>

                      {job.address && (
                        <div>
                          <div className="text-xs font-medium text-[#4B5563] mb-2">Address</div>
                          <div className="flex items-start gap-2 p-3 bg-[#F8F9FA] rounded-lg">
                            <MapPin className="w-5 h-5 text-[#4B5563] mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-[#111827] font-medium">{job.address}</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-[#E5E7EB]">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-[#4B5563] mb-2">Date</div>
                            <EditableField
                              value={job.scheduled_date}
                              onSave={(val) => handleFieldSave('scheduled_date', job.scheduled_date, val)}
                              type="date"
                              icon={Calendar}
                              displayFormat={(val) => val ? format(parseISO(val), 'MMM d, yyyy') : 'Set date'}
                              placeholder="Set date"
                            />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-[#4B5563] mb-2">Time</div>
                            <EditableField
                              value={job.scheduled_time}
                              onSave={(val) => handleFieldSave('scheduled_time', job.scheduled_time, val)}
                              type="time"
                              icon={Clock}
                              placeholder="Time"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-[#4B5563] mb-2">Job Type</div>
                        <EditableField
                          value={job.job_type_id}
                          onSave={handleJobTypeChange}
                          type="select"
                          icon={Briefcase}
                          options={jobTypes.map((jt) => ({ value: jt.id, label: jt.name }))}
                          displayFormat={(val) => jobTypes.find((jt) => jt.id === val)?.name || val}
                          placeholder="Select job type"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-medium text-[#4B5563] mb-2">Product</div>
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
                          placeholder="Select product"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-medium text-[#4B5563] mb-2">Technicians</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : job.assigned_to_name ? [job.assigned_to_name] : []).map((name, idx) => (
                            <div
                              key={idx}
                              className={`${getAvatarColor(name)} w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm`}
                              title={name}
                            >
                              {getInitials(name)}
                            </div>
                          ))}
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
                  </CardContent>
                </Card>

                {/* On-Site Actions - Technician Only */}
                {isTechnician && (
                  <Card className="bg-gradient-to-br from-[#FAE008] to-[#e5d007] rounded-xl border-2 border-black shadow-lg">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-bold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        On-Site Actions
                      </h3>
                       {!activeCheckIn ? (
                        <Button
                          onClick={handleCheckIn}
                          disabled={checkInMutation.isPending}
                          className="bg-black hover:bg-gray-900 text-[#FAE008] font-bold h-14 w-full text-base shadow-lg"
                        >
                          <LogIn className="w-5 h-5 mr-2" />
                          {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-white/90 border-2 border-black rounded-lg p-3">
                            <div className="flex items-center gap-2 text-black font-bold text-sm">
                              <Timer className="w-4 h-4 animate-pulse" />
                              On-site since {format(new Date(activeCheckIn.check_in_time), 'h:mm a')}
                            </div>
                          </div>
                          <Button
                            onClick={() => setActiveTab('sitevisit')}
                            className="bg-black hover:bg-gray-900 text-[#FAE008] font-bold w-full h-14 text-base shadow-lg"
                          >
                            <ClipboardCheck className="w-5 h-5 mr-2" />
                            Complete Visit
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              onClick={() => setActiveTab('photos')}
                              className="bg-white hover:bg-gray-50 text-black font-semibold border-2 border-black h-12"
                            >
                              <ImageIcon className="w-4 h-4 mr-2" />
                              Photos
                            </Button>
                            <Button
                              onClick={() => setActiveTab('measurements')}
                              className="bg-white hover:bg-gray-50 text-black font-semibold border-2 border-black h-12"
                            >
                              <Ruler className="w-4 h-4 mr-2" />
                              Measure
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide mb-3">Notes</h3>
                    <div className="border-2 border-[#E5E7EB] rounded-xl p-3 focus-within:border-[#FAE008] transition-all">
                      <RichTextEditor
                        value={notes}
                        onChange={setNotes}
                        onBlur={handleNotesBlur}
                        placeholder="Add notes..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Information */}
                <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide mb-3">Information</h3>
                    <div className="border-2 border-[#E5E7EB] rounded-xl p-3 focus-within:border-[#FAE008] transition-all">
                      <RichTextEditor
                        value={additionalInfo}
                        onChange={setAdditionalInfo}
                        onBlur={handleAdditionalInfoBlur}
                        placeholder="Add additional information..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Last Visit Card */}
                {jobSummaries.length > 0 && (
                  <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide mb-4">Last Visit</h3>
                      {jobSummaries.slice(0, 1).map((summary) => (
                        <div key={summary.id} className="space-y-3">
                          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                            <span className="text-sm font-semibold text-[#111827]">{summary.technician_name}</span>
                            <span className="text-xs text-[#4B5563]">
                              {format(new Date(summary.checkout_time), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          
                          {summary.outcome && (
                            <Badge className={`${outcomeColors[summary.outcome]} text-xs font-semibold`}>
                              {summary.outcome.replace(/_/g, ' ')}
                            </Badge>
                          )}

                          {summary.overview && (
                            <div>
                              <div className="text-xs font-semibold text-[#4B5563] mb-1">Overview:</div>
                              <div className="text-sm text-[#111827]" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                            </div>
                          )}
                          
                          {summary.next_steps && (
                            <div>
                              <div className="text-xs font-semibold text-[#4B5563] mb-1">Next Steps:</div>
                              <div className="text-sm text-[#111827]" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Pricing */}
                <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide mb-3">Pricing Provided</h3>
                    <Input
                      value={pricingProvided}
                      onChange={(e) => setPricingProvided(e.target.value)}
                      onBlur={handlePricingProvidedBlur}
                      placeholder="Enter pricing..."
                      className="h-12 border-2 border-[#E5E7EB] focus:border-[#FAE008] rounded-xl"
                    />
                  </CardContent>
                </Card>

                {/* Project Association Card */}
                {job.project_id && (
                  <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide">Project</h3>
                        <FolderKanban className="w-5 h-5 text-[#4B5563]" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-base font-semibold text-[#111827]">{job.project_name}</div>
                        <Link 
                          to={createPageUrl("Projects") + `?projectId=${job.project_id}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                        >
                          View Project
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Status Timeline */}
                <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide mb-4">Status Timeline</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <CheckSquare className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-[#111827]">Created</div>
                          <div className="text-xs text-[#4B5563]">
                            {job.created_date && format(new Date(job.created_date), 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                      </div>

                      {job.assigned_to && job.assigned_to.length > 0 && (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-[#111827]">Assigned</div>
                            <div className="text-xs text-[#4B5563]">
                              {Array.isArray(job.assigned_to_name) ? job.assigned_to_name.join(', ') : job.assigned_to_name}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeCheckIn && (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <Timer className="w-5 h-5 text-orange-600 animate-pulse" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-[#111827]">In Progress</div>
                            <div className="text-xs text-[#4B5563]">
                              Since {format(new Date(activeCheckIn.check_in_time), 'h:mm a')}
                            </div>
                          </div>
                        </div>
                      )}

                      {job.status === 'completed' && (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <CheckSquare className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-[#111827]">Completed</div>
                            <div className="text-xs text-[#4B5563]">Job finished</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Project Jobs */}
                {job.project_id && projectJobs.length > 0 && (
                  <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wide mb-3 flex items-center gap-2">
                        <FolderKanban className="w-5 h-5" />
                        Project History ({projectJobs.length})
                      </h3>
                      <div className="space-y-2">
                        {projectJobs.map((pJob) => (
                          <div key={pJob.id} className="border border-[#E5E7EB] rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-[#111827]">
                                  {pJob.job_type_name || 'Job'} #{pJob.job_number}
                                </div>
                                {pJob.scheduled_date && (
                                  <div className="text-xs text-[#4B5563] flex items-center gap-1 mt-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(parseISO(pJob.scheduled_date), 'MMM d, yyyy')}
                                  </div>
                                )}
                              </div>
                              {pJob.status && (
                               <Badge className="status-chip capitalize">
                                 {pJob.status.replace(/_/g, ' ')}
                               </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {activeTab === "sitevisit" && (
            <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm max-w-3xl mx-auto">
              <CardContent className="p-5 space-y-4">
                <div>
                  <Label className="text-[13px] font-semibold text-[#111111] mb-2 block">Overview *</Label>
                  <div className="border-2 border-[#E2E3E5] rounded-xl p-3 focus-within:border-[#FAE008] transition-all">
                    <RichTextEditor
                      value={overview}
                      onChange={setOverview}
                      onBlur={handleOverviewBlur}
                      placeholder="Overview..."
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[13px] font-semibold text-[#111111] mb-2 block">Next Steps *</Label>
                  <div className="border-2 border-[#E2E3E5] rounded-xl p-3 focus-within:border-[#FAE008] transition-all">
                    <RichTextEditor
                      value={nextSteps}
                      onChange={setNextSteps}
                      onBlur={handleNextStepsBlur}
                      placeholder="Next steps..."
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[13px] font-semibold text-[#111111] mb-2 block">Communication *</Label>
                  <div className="border-2 border-[#E2E3E5] rounded-xl p-3 focus-within:border-[#FAE008] transition-all">
                    <RichTextEditor
                      value={communicationWithClient}
                      onChange={setCommunicationWithClient}
                      onBlur={handleCommunicationBlur}
                      placeholder="Communication notes..."
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[13px] font-semibold text-[#111111] mb-2 block">Outcome *</Label>
                  <Select value={outcome} onValueChange={handleOutcomeChange}>
                    <SelectTrigger className="h-12 text-[14px] border-2 border-[#E2E3E5] focus:border-[#FAE008] rounded-xl">
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

                {activeCheckIn && (
                  <Button
                    onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold w-full h-14 mt-4"
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "photos" && (
            <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm max-w-3xl mx-auto">
              <CardContent className="p-5">
                <EditableFileUpload
                  files={job.image_urls || []}
                  onFilesChange={handleImagesChange}
                  accept="image/*,video/*"
                  multiple={true}
                  icon={ImageIcon}
                  label="Photos & Videos"
                  emptyText="Upload media"
                />
              </CardContent>
            </Card>
          )}

          {activeTab === "measurements" && (
            <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm max-w-3xl mx-auto">
              <CardContent className="p-5">
                <h3 className="text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide mb-3">Measurements</h3>
                <MeasurementsForm
                  measurements={measurements}
                  onChange={handleMeasurementsChange}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === "attachments" && (
            <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm max-w-3xl mx-auto">
              <CardContent className="p-5 space-y-4">
                {/* Quote */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide">Quote</h3>
                  </div>
                  {job.quote_url ? (
                    <div className="space-y-2">
                      <div className="bg-white border-2 border-[#E2E3E5] rounded-xl p-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-semibold text-[#111111]">Quote Document</div>
                            <div className="text-[12px] text-[#4F4F4F]">PDF file</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(job.quote_url, '_blank')}
                              className="h-8 w-8"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleQuoteChange(null)}
                              className="h-8 w-8 text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={quoteCaption}
                          onChange={(e) => setQuoteCaption(e.target.value)}
                          onBlur={handleQuoteCaptionBlur}
                          placeholder="Add caption..."
                          className="h-10 border-2 border-[#E2E3E5] focus:border-[#FAE008] rounded-lg text-[13px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <EditableFileUpload
                      files={job.quote_url}
                      onFilesChange={handleQuoteChange}
                      accept=".pdf,.doc,.docx"
                      multiple={false}
                      icon={FileText}
                      label=""
                      emptyText="Upload quote"
                    />
                  )}
                </div>

                {/* Invoice */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide">Invoice</h3>
                  </div>
                  {job.invoice_url ? (
                    <div className="space-y-2">
                      <div className="bg-white border-2 border-[#E2E3E5] rounded-xl p-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-semibold text-[#111111]">Invoice Document</div>
                            <div className="text-[12px] text-[#4F4F4F]">PDF file</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(job.invoice_url, '_blank')}
                              className="h-8 w-8"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleInvoiceChange(null)}
                              className="h-8 w-8 text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={invoiceCaption}
                          onChange={(e) => setInvoiceCaption(e.target.value)}
                          onBlur={handleInvoiceCaptionBlur}
                          placeholder="Add caption..."
                          className="h-10 border-2 border-[#E2E3E5] focus:border-[#FAE008] rounded-lg text-[13px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <EditableFileUpload
                      files={job.invoice_url}
                      onFilesChange={handleInvoiceChange}
                      accept=".pdf,.doc,.docx"
                      multiple={false}
                      icon={FileText}
                      label=""
                      emptyText="Upload invoice"
                    />
                  )}
                </div>

                {/* Other Documents */}
                <div className="pt-3 border-t border-[#E2E3E5]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide">Other Documents</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById('other-docs-input').click()}
                      disabled={uploadingOther}
                      className="h-10"
                    >
                      {uploadingOther ? (
                        <>Uploading...</>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Add
                        </>
                      )}
                    </Button>
                    <input
                      id="other-docs-input"
                      type="file"
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.txt"
                      multiple
                      className="hidden"
                      onChange={handleOtherDocumentUpload}
                    />
                  </div>

                  {otherDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {otherDocuments.map((doc, index) => (
                        <div key={index} className="bg-white border-2 border-[#E2E3E5] rounded-xl p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[14px] font-semibold text-[#111111]">{doc.caption || `Document ${index + 1}`}</div>
                              <div className="text-[12px] text-[#4F4F4F]">{doc.url.split('.').pop().toUpperCase()} file</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(doc.url, '_blank')}
                                className="h-8 w-8"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveOtherDocument(index)}
                                className="h-8 w-8 text-red-600"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <Input
                            value={doc.caption}
                            onChange={(e) => handleOtherDocumentCaptionChange(index, e.target.value)}
                            onBlur={() => handleOtherDocumentCaptionBlur(index)}
                            placeholder="Add caption..."
                            className="h-10 border-2 border-[#E2E3E5] focus:border-[#FAE008] rounded-lg text-[13px]"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      className="text-center py-8 border-2 border-dashed border-[#E2E3E5] rounded-xl cursor-pointer hover:border-[#FAE008] transition-colors"
                      onClick={() => document.getElementById('other-docs-input').click()}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-[13px] font-medium text-[#4F4F4F]">Upload other documents</p>
                      <p className="text-[12px] text-[#4F4F4F] mt-1">PDF, DOC, XLS, TXT</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "audit" && (
            <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm max-w-3xl mx-auto">
              <CardContent className="p-5">
                {completedCheckIns.length > 0 && (
                  <div className="space-y-3 mb-4">
                    <h3 className="text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide">Time Tracking</h3>
                    {completedCheckIns.map((checkIn, index) => (
                      <Card key={checkIn.id} className="card-interactive">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[13px] text-[#4F4F4F]">Visit {completedCheckIns.length - index}</span>
                            <span className="text-[14px] font-semibold text-[#111111]">{checkIn.technician_name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[13px]">
                            <div>
                              <span className="text-[#4F4F4F]">In:</span>
                              <div className="font-medium text-[#111111]">
                                {format(new Date(checkIn.check_in_time), 'MMM d, h:mm a')}
                              </div>
                            </div>
                            <div>
                              <span className="text-[#4F4F4F]">Out:</span>
                              <div className="font-medium text-[#111111]">
                                {format(new Date(checkIn.check_out_time), 'MMM d, h:mm a')}
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 mt-2 border-t border-[#E2E3E5]">
                            <div className="flex items-center justify-between">
                              <span className="text-[#4F4F4F]">Duration:</span>
                              <span className="text-[14px] font-bold text-[#111111]">
                                {checkIn.duration_hours.toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {totalJobTime > 0 && (
                      <div className="bg-[#FEF8C8] border border-[#E2E3E5] rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold text-[#111111]">Total:</span>
                          <span className="text-[16px] font-bold text-[#111111]">{totalJobTime.toFixed(1)}h</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {jobSummaries.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-[#E2E3E5]">
                    <h3 className="text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide">Visit Summaries</h3>
                    {jobSummaries.map((summary) => (
                      <Card key={summary.id} className="card-interactive">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-semibold text-[#111111]">{summary.technician_name}</span>
                            <span className="text-[12px] text-[#4F4F4F]">
                              {format(new Date(summary.checkout_time), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          
                          {summary.outcome && (
                            <Badge className={`${outcomeColors[summary.outcome]} mb-2`}>
                              {summary.outcome.replace(/_/g, ' ')}
                            </Badge>
                          )}

                          <div className="space-y-2 text-[13px]">
                            {summary.overview && (
                              <div>
                                <div className="text-[#4F4F4F] font-medium mb-0.5">Overview:</div>
                                <div className="text-[#111111]" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                              </div>
                            )}
                            
                            {summary.next_steps && (
                              <div>
                                <div className="text-[#4F4F4F] font-medium mb-0.5">Next Steps:</div>
                                <div className="text-[#111111]" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[18px] font-semibold">Delete Job?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-[#4F4F4F]">
              This job will be moved to the archive. You can restore it within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClick}
              className="bg-[#DC2626] hover:bg-[#B91C1C] h-12"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}