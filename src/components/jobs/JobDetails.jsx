import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Phone, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, DollarSign, Sparkles, LogIn, FileCheck, History, Package, ClipboardCheck, LogOut, Timer, AlertCircle, ChevronDown, Mail, Navigation, Trash2, FolderKanban, Camera, Edit, ExternalLink, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import PriceListModal from "./PriceListModal";
import TechnicianAssistant from "./TechnicianAssistant";
import MeasurementsForm from "./MeasurementsForm";
import ChangeHistoryModal from "./ChangeHistoryModal";
import EditableField from "./EditableField";
import EditableFileUpload from "./EditableFileUpload";
import CustomerEditModal from "../customers/CustomerEditModal";
import RichTextField from "../common/RichTextField";
import { determineJobStatus } from "./jobStatusHelper";
import TechnicianAvatar, { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import JobActivityLog from "./JobActivityLog";
import JobChat from "./JobChat";
import JobMapView from "./JobMapView";
import XeroInvoiceCard from "../invoices/XeroInvoiceCard";
import CreateInvoiceModal from "../invoices/CreateInvoiceModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  "Open": "bg-slate-100 text-slate-800 border-slate-200",
  "Scheduled": "bg-blue-100 text-blue-800 border-blue-200",
  "Completed": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
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

export default function JobDetails({ job: initialJob, onClose, onStatusChange, onDelete }) {
  const navigate = useNavigate();
  const { data: job = initialJob } = useQuery({
    queryKey: ['job', initialJob.id],
    queryFn: () => base44.entities.Job.get(initialJob.id),
    initialData: initialJob
  });
  const [showPriceList, setShowPriceList] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomerEdit, setShowCustomerEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
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
    queryFn: () => base44.entities.Job.filter({ project_id: job.project_id, deleted_at: { $exists: false } }),
    enabled: !!job.project_id
  });

  const projectJobs = allProjectJobs.filter((j) => j.id !== job.id);

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

  const { data: xeroInvoice } = useQuery({
    queryKey: ['xeroInvoice', job.xero_invoice_id],
    queryFn: () => base44.entities.XeroInvoice.get(job.xero_invoice_id),
    enabled: !!job.xero_invoice_id
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
      const checkOutTime = new Date().toISOString();
      const checkInTime = new Date(activeCheckIn.check_in_time);
      const durationHours = (new Date(checkOutTime) - checkInTime) / (1000 * 60 * 60);
      const durationMinutes = Math.round(durationHours * 60);

      // Check if this is a mistake check-in (less than 1 minute)
      const isMistake = durationMinutes < 1;

      // Only validate fields if this is a real visit
      if (!isMistake) {
        if (!overview || !nextSteps || !communicationWithClient || !outcome) {
          throw new Error("Please fill in all Site Visit fields before checking out.");
        }

        if (!job.image_urls || job.image_urls.length === 0) {
          throw new Error("Please upload at least one photo before checking out.");
        }
      }

      // Determine new status
      const newStatus = isMistake ? job.status : determineJobStatus(job.scheduled_date, outcome, false, job.status);

      // Only create job summary if this is not a mistake check-in
      if (!isMistake) {
        // Build scheduled datetime
        let scheduledDatetime = null;
        if (job.scheduled_date) {
          const dateStr = job.scheduled_date;
          const timeStr = job.scheduled_time || '09:00';
          scheduledDatetime = `${dateStr}T${timeStr}:00.000Z`;
        }

        // Create job summary
        await base44.entities.JobSummary.create({
          job_id: job.id,
          project_id: job.project_id || null,
          job_number: job.job_number,
          job_type: job.job_type_name || null,
          scheduled_datetime: scheduledDatetime,
          technician_email: user.email,
          technician_name: user.full_name,
          check_in_time: activeCheckIn.check_in_time,
          check_out_time: checkOutTime,
          duration_minutes: durationMinutes,
          overview,
          next_steps: nextSteps,
          communication_with_client: communicationWithClient,
          outcome,
          status_at_checkout: newStatus,
          photo_urls: job.image_urls || [],
          measurements: job.measurements || null
        });
      }

      await base44.entities.CheckInOut.update(activeCheckIn.id, {
        check_out_time: checkOutTime,
        duration_hours: Math.round(durationHours * 10) / 10
      });

      // Update job status and save the visit details
      await base44.entities.Job.update(job.id, {
        overview: overview,
        next_steps: nextSteps,
        communication_with_client: communicationWithClient,
        outcome: outcome,
        status: newStatus
      });
    },
    onSuccess: () => {
      setValidationError("");
      queryClient.invalidateQueries({ queryKey: ['checkIns', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobSummaries', job.id] });
      queryClient.invalidateQueries({ queryKey: ['projectJobSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => {
      setValidationError(error.message);
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Job.update(job.id, { [field]: value }),
    onSuccess: (updatedJob) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.setQueryData(['job', job.id], (oldData) => ({
        ...oldData,
        ...updatedJob
      }));
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
  const isAdmin = user?.role === 'admin';

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData) => {
      const response = await base44.functions.invoke('createInvoiceFromJob', { 
        job_id: job.id,
        lineItems: invoiceData.lineItems,
        total: invoiceData.total
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['xeroInvoice'] });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      setShowInvoiceModal(false);
      toast.success(`Invoice #${data.xero_invoice_number} created successfully in Xero`);
    },
    onError: (error) => {
      console.error('Invoice creation error:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      toast.error(`Failed to create invoice: ${errorMsg}`);
    }
  });

  const syncInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('syncXeroInvoiceStatus', { 
        invoice_id: xeroInvoice.id 
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xeroInvoice', job.xero_invoice_id] });
    }
  });

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
    
    // Auto-update status to "Scheduled" when scheduling a future date
    if (fieldName === 'scheduled_date' && newValue) {
      const scheduledDate = new Date(newValue);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (scheduledDate >= today && job.status === 'Open') {
        const updates = {
          scheduled_date: newValue,
          status: 'Scheduled'
        };
        
        base44.entities.Job.update(job.id, updates).then(() => {
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.setQueryData(['job', job.id], (oldData) => ({
            ...oldData,
            ...updates
          }));
        });
        return;
      }
    }
    
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

    // Auto-update status to Completed for specific outcomes
    if (value === "send_invoice" || value === "completed") {
      updateJobMutation.mutate({ field: 'status', value: "Completed" });
      return;
    }

    // Auto-update status to Open for specific outcomes
    if (value === "new_quote" || value === "update_quote" || value === "return_visit_required") {
      updateJobMutation.mutate({ field: 'status', value: "Open" });
      return;
    }

    // Update status based on centralized logic - check if there's an active check-in
    const newStatus = determineJobStatus(job.scheduled_date, value, !!activeCheckIn, job.status);
    if (newStatus !== job.status) {
      updateJobMutation.mutate({ field: 'status', value: newStatus });
    }
  };

  const handleAssignedToChange = (emails) => {
    const newAssignedEmails = Array.isArray(emails) ? emails : emails ? [emails] : [];
    const currentAssignedToNormalized = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
    
    const techNames = newAssignedEmails.map((email) => {
      const tech = technicians.find((t) => t.email === email);
      return tech?.full_name;
    }).filter(Boolean);
    
    const updates = {
      assigned_to: newAssignedEmails,
      assigned_to_name: techNames
    };
    
    logChange('assigned_to', currentAssignedToNormalized, newAssignedEmails);
    
    base44.entities.Job.update(job.id, updates).then(() => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.setQueryData(['job', job.id], (oldData) => ({
        ...oldData,
        ...updates
      }));
    });
  };

  const handleJobTypeChange = (jobTypeId) => {
    const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
    logChange('job_type_id', job.job_type_id, jobTypeId);
    
    const updates = {
      job_type_id: jobTypeId,
      job_type_name: jobType?.name || null,
      expected_duration: jobType?.estimated_duration || null
    };
    
    base44.entities.Job.update(job.id, updates).then(() => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.setQueryData(['job', job.id], (oldData) => ({
        ...oldData,
        ...updates
      }));
    });
  };

  const handleImagesChange = async (urls) => {
    // Update job with new images
    updateJobMutation.mutate({ field: 'image_urls', value: urls });
    
    // Create Photo records for any new images
    const existingUrls = job.image_urls || [];
    const newUrls = Array.isArray(urls) ? urls.filter(url => !existingUrls.includes(url)) : [];
    
    if (newUrls.length > 0 && user) {
      for (const url of newUrls) {
        try {
          await base44.entities.Photo.create({
            image_url: url,
            job_id: job.id,
            job_number: job.job_number,
            customer_id: job.customer_id,
            customer_name: job.customer_name,
            project_id: job.project_id || undefined,
            project_name: job.project_name || undefined,
            address: job.address,
            uploaded_at: new Date().toISOString(),
            product_type: job.product || undefined,
            technician_email: user.email,
            technician_name: user.full_name
          });
        } catch (error) {
          console.error('Failed to create photo record:', error);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    }
  };

  const handleQuoteChange = (url) => {
    updateJobMutation.mutate({ field: 'quote_url', value: url });
  };

  const handleInvoiceChange = (url) => {
    updateJobMutation.mutate({ field: 'invoice_url', value: url });
  };

  const handleOtherDocumentsChange = (urls) => {
    updateJobMutation.mutate({ field: 'other_documents', value: urls });
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
        <CardHeader className="border-b border-[#E5E7EB] bg-white p-3 md:p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 flex-shrink-0 hover:bg-[#F3F4F6] rounded-lg transition-colors">

                <ArrowLeft className="w-5 h-5 text-[#111827]" />
              </Button>
              {job.scheduled_date && (
                <div className="text-[12px] text-[#6B7280] leading-[1.35] hidden sm:block">
                  <span>Scheduled for {format(parseISO(job.scheduled_date), 'EEEE, MMM d, yyyy')}
                  {job.scheduled_time && ` at ${job.scheduled_time}`}
                  {job.expected_duration && ` for ${job.expected_duration}h`}</span>
                </div>
              )}
            </div>

            {!isTechnician &&
            <div className="flex gap-1 flex-shrink-0">
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
                <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg"
                title="Delete">

                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            }
          </div>

          <div className="space-y-3">
            {/* New Horizontal Layout: Left | Middle */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Left Group: Customer Name + Job Number */}
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle
                  className="text-[22px] font-semibold text-[#111827] leading-[1.2] cursor-pointer hover:text-[#FAE008] transition-colors"
                  onClick={() => setShowCustomerEdit(true)}>
                  {job.customer_name}
                </CardTitle>
                <Badge className="bg-white text-[#6B7280] border border-[#E5E7EB] font-medium text-[12px] leading-[1.35] px-2.5 py-0.5 rounded-lg hover:bg-white">
                  #{job.job_number}
                </Badge>
              </div>

              {/* Middle Group: Job Type + Product + Customer Type Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <EditableField
                  value={job.job_type_id}
                  onSave={handleJobTypeChange}
                  type="select"
                  options={jobTypes.map((jt) => ({ value: jt.id, label: jt.name }))}
                  displayFormat={(val) => {
                    const typeName = jobTypes.find((jt) => jt.id === val)?.name || val;
                    return (
                      <Badge className="bg-[#EDE9FE] text-[#6D28D9] border-0 font-medium text-[12px] leading-[1.35] px-3 py-1 rounded-lg hover:bg-[#EDE9FE]">
                        {typeName}
                      </Badge>
                    );
                  }}
                  placeholder="Job type"
                />
                <EditableField
                  value={job.product}
                  onSave={(val) => handleFieldSave('product', job.product, val)}
                  type="select"
                  options={[
                    { value: "Garage Door", label: "Garage Door" },
                    { value: "Gate", label: "Gate" },
                    { value: "Roller Shutter", label: "Roller Shutter" },
                    { value: "Multiple", label: "Multiple" },
                    { value: "Custom Garage Door", label: "Custom Garage Door" }
                  ]}
                  displayFormat={(val) => (
                    <Badge className={`${productColors[val] || 'bg-blue-100 text-blue-700'} font-medium border-0 px-3 py-1 rounded-lg text-[12px] leading-[1.35] hover:opacity-100`}>
                      {val}
                    </Badge>
                  )}
                  placeholder="Product"
                />
                {job.customer_type && (
                  <Badge className={`${customerTypeColors[job.customer_type] || 'bg-gray-100 text-gray-700'} border-0 font-medium text-[12px] leading-[1.35] px-3 py-1 rounded-lg hover:opacity-100`}>
                    {job.customer_type}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-start gap-2.5">
                <Navigation className="text-green-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#6B7280] font-normal leading-[1.35] mb-0.5">Address</div>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
                    className="text-[14px] text-[#111827] leading-[1.4] hover:text-green-600 transition-colors text-left"
                  >
                    {job.address}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="text-blue-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#6B7280] font-normal leading-[1.35] mb-0.5">Phone</div>
                  {job.customer_phone ? (
                    <a
                      href={`tel:${job.customer_phone}`}
                      className="text-[14px] text-[#111827] leading-[1.4] hover:text-blue-600 transition-colors"
                    >
                      {job.customer_phone}
                    </a>
                  ) : (
                    <span className="text-[14px] text-[#6B7280] leading-[1.4]">-</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <User className="text-purple-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#6B7280] font-normal leading-[1.35] mb-0.5">Assigned</div>
                  <EditableField
                    value={Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : []}
                    onSave={handleAssignedToChange}
                    type="multi-select"
                    options={technicians.map((t) => ({ value: t.email, label: t.full_name }))}
                    displayFormat={(val) => {
                      const emailsToDisplay = Array.isArray(val) ? val : val ? [val] : [];
                      const namesToDisplay = Array.isArray(job.assigned_to_name) ? job.assigned_to_name : job.assigned_to_name ? [job.assigned_to_name] : [];

                      if (namesToDisplay.length === 0) {
                        return (
                          <TechnicianAvatar
                            technician={{ email: '', full_name: 'Unassigned', id: 'unassigned' }}
                            size="sm"
                            showPlaceholder={true}
                          />
                        );
                      }

                      return (
                        <TechnicianAvatarGroup
                          technicians={emailsToDisplay.map((email, idx) => ({
                            email,
                            full_name: namesToDisplay[idx] || email,
                            id: email
                          }))}
                          maxDisplay={3}
                          size="sm"
                        />
                      );
                    }}
                    placeholder="Assign"
                  />
                </div>
              </div>
            </div>

            <Collapsible defaultOpen={true} className="bg-white rounded-lg border border-[#E5E7EB]">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-[#F9FAFB] transition-colors group">
                <div className="text-[12px] text-[#6B7280] font-normal leading-[1.35]">Schedule</div>
                <ChevronDown className="w-4 h-4 text-[#6B7280] transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-5 h-5 text-[#4B5563] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-[#6B7280] font-normal leading-[1.35] mb-0.5">Date</div>
                        <EditableField
                          value={job.scheduled_date}
                          onSave={(val) => handleFieldSave('scheduled_date', job.scheduled_date, val)}
                          type="date"
                          displayFormat={(val) => format(parseISO(val), 'MMM d, yyyy')}
                          placeholder="Set date"
                          className="text-[14px] font-medium text-[#111827] leading-[1.4]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-[#4B5563] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-[#6B7280] font-normal leading-[1.35] mb-0.5">Time</div>
                        <EditableField
                          value={job.scheduled_time}
                          onSave={(val) => handleFieldSave('scheduled_time', job.scheduled_time, val)}
                          type="time"
                          placeholder="Time"
                          className="text-[14px] font-medium text-[#111827] leading-[1.4]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Timer className="w-5 h-5 text-[#4B5563] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-[#6B7280] font-normal leading-[1.35] mb-0.5">Duration (hours)</div>
                        <EditableField
                          value={job.expected_duration}
                          onSave={(val) => handleFieldSave('expected_duration', job.expected_duration, parseFloat(val) || null)}
                          type="text"
                          displayFormat={(val) => val ? `${val}h` : '-'}
                          placeholder="Duration"
                          className="text-[14px] font-medium text-[#111827] leading-[1.4]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardHeader>



        {/* Technician Sticky Bottom Actions */}
        {isTechnician &&
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-lg z-50 safe-area-bottom p-3">
            <div className="grid grid-cols-4 gap-2 max-w-screen-sm mx-auto">
              {job.customer_phone &&
            <Button
              variant="outline"
              onClick={() => window.location.href = `tel:${job.customer_phone}`}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-blue-50 hover:border-blue-200 transition-all rounded-lg">

                  <Phone className="w-5 h-5 text-blue-600" />
                  <span className="text-[10px] font-medium text-[#111827] leading-[1.35]">Call</span>
                </Button>
            }
              <Button
              variant="outline"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-green-50 hover:border-green-200 transition-all rounded-lg">

                <Navigation className="w-5 h-5 text-green-600" />
                <span className="text-[10px] font-medium text-[#111827] leading-[1.35]">Navigate</span>
              </Button>
              {!activeCheckIn ?
            <Button
              onClick={handleCheckIn}
              disabled={checkInMutation.isPending}
              className="flex flex-col items-center gap-1 h-auto py-3 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold rounded-lg">

                  <LogIn className="w-5 h-5" />
                  <span className="text-[10px] leading-[1.35]">Check In</span>
                </Button> :

            <Button
              onClick={handleCheckOut}
              disabled={checkOutMutation.isPending}
              className="flex flex-col items-center gap-1 h-auto py-3 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold rounded-lg">

                  <LogOut className="w-5 h-5" />
                  <span className="text-[10px] leading-[1.35]">Check Out</span>
                </Button>
            }
              <Button
              variant="outline"
              onClick={() => setShowAssistant(true)}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#FAE008]/10 hover:border-[#FAE008] transition-all rounded-lg">

                <Sparkles className="w-5 h-5 text-[#111827]" />
                <span className="text-[10px] font-medium text-[#111827] leading-[1.35]">AI</span>
              </Button>
            </div>
          </div>
        }
        
        <CardContent className={`p-3 md:p-4 space-y-3 ${isTechnician ? 'pb-32' : ''}`}>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start mb-3 overflow-x-auto flex-nowrap">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="visit" className="flex-1">
                <ClipboardCheck className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Visit</span>
              </TabsTrigger>
              <TabsTrigger value="form" className="flex-1">
                <FileCheck className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Form</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="flex-1">
                <ImageIcon className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Files</span>
              </TabsTrigger>

              <TabsTrigger value="chat" className="flex-1">
                <MessageCircle className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="map" className="flex-1">
                <MapPin className="w-4 h-4 mr-1.5" />
                <span className="hidden md:inline">Map</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-3">
              {job.project_id && projectJobs.length > 0 &&
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                  <h3 className="text-[14px] font-semibold text-blue-900 leading-[1.4] mb-2 flex items-center gap-1.5">
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
                      <Badge className={`${statusColors[pJob.status]} text-xs font-semibold border hover:opacity-100`}>
                              {pJob.status}
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
                    <Badge className={`${outcomeColors[pJob.outcome]} text-xs font-semibold border mt-1.5 hover:opacity-100`}>
                            Outcome: {pJob.outcome?.replace(/_/g, ' ') || pJob.outcome}
                          </Badge>
                    }
                      </div>
                  )}
                  </div>
                </div>
              }

              <div>
                <RichTextField
                  label="Job Info"
                  value={additionalInfo}
                  onChange={setAdditionalInfo}
                  onBlur={handleAdditionalInfoBlur}
                  placeholder="Add any additional information or context…"
                />
              </div>

              <div>
                <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">Pricing</label>
                <Input
                  value={pricingProvided}
                  onChange={(e) => setPricingProvided(e.target.value)}
                  onBlur={handlePricingProvidedBlur}
                  placeholder="Enter pricing..."
                />
              </div>

              <div>
                <RichTextField
                  label="Notes"
                  value={notes}
                  onChange={setNotes}
                  onBlur={handleNotesBlur}
                  placeholder="Add notes and instructions for technicians…"
                />
              </div>

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
                    <h4 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">Previous Visit Summaries ({jobSummaries.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-3 space-y-3">
                    {jobSummaries.map((summary) =>
                  <div key={summary.id} className="bg-white border-2 border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-[#000000]">{summary.technician_name}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {format(new Date(summary.check_out_time), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        
                        {summary.outcome &&
                    <Badge className={`${outcomeColors[summary.outcome]} mb-3 font-semibold border-2 hover:opacity-100`}>
                            {summary.outcome?.replace(/_/g, ' ') || summary.outcome}
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
                <RichTextField
                  label="Overview *"
                  value={overview}
                  onChange={setOverview}
                  onBlur={handleOverviewBlur}
                  placeholder="Provide a brief summary of what was done during this visit…"
                  helperText="Required for checkout"
                />

                <RichTextField
                  label="Next Steps *"
                  value={nextSteps}
                  onChange={setNextSteps}
                  onBlur={handleNextStepsBlur}
                  placeholder="What needs to happen next? Any follow-up required…"
                  helperText="Required for checkout"
                />

                <RichTextField
                  label="Communication *"
                  value={communicationWithClient}
                  onChange={setCommunicationWithClient}
                  onBlur={handleCommunicationBlur}
                  placeholder="What was discussed with the client? Any agreements made…"
                  helperText="Required for checkout"
                />

                {isAdmin && (
                  <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
                    <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
                      <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
                        Billing & Invoice
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      {!xeroInvoice ? (
                        <div className="text-center py-6">
                          <DollarSign className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
                          <p className="text-[14px] text-[#6B7280] mb-4">
                            No invoice has been created for this job yet.
                          </p>
                          <Button
                            onClick={() => setShowInvoiceModal(true)}
                            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm h-10 px-6"
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Send via Xero
                          </Button>
                        </div>
                      ) : (
                        <XeroInvoiceCard
                          invoice={xeroInvoice}
                          onRefreshStatus={() => syncInvoiceMutation.mutate()}
                          onViewInXero={() => window.open(xeroInvoice.pdf_url, '_blank')}
                          isRefreshing={syncInvoiceMutation.isPending}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}

                <div>
                  <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">Outcome *</Label>
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

                {activeCheckIn && isTechnician &&
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-lg z-50 p-3">
                    <Button
                    onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-11 font-semibold text-base rounded-xl shadow-md hover:shadow-lg transition-all max-w-screen-sm mx-auto">

                      <LogOut className="w-4 h-4 mr-2" />
                      {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                    </Button>
                  </div>
                }
                {activeCheckIn && !isTechnician &&
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
                  <CollapsibleTrigger className="flex items-center justify-between w-full group bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3 hover:bg-[#F3F4F6] transition-colors">
                    <h4 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">Time Tracking ({completedCheckIns.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-2.5 space-y-2.5">
                    {completedCheckIns.map((checkIn, index) =>
                  <div key={checkIn.id} className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-2.5">
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
                    <h4 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">Previous Visit Summaries ({jobSummaries.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-3 space-y-3">
                    {jobSummaries.map((summary) =>
                  <div key={summary.id} className="bg-white border-2 border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-[#000000]">{summary.technician_name}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {format(new Date(summary.check_out_time), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        
                        {summary.outcome &&
                    <Badge className={`${outcomeColors[summary.outcome]} mb-3 font-semibold border-2 hover:opacity-100`}>
                            {summary.outcome?.replace(/_/g, ' ') || summary.outcome}
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
                <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2] mb-3">Measurements</h3>
                <MeasurementsForm
                  measurements={measurements}
                  onChange={handleMeasurementsChange} />

              </div>

              {jobSummaries.length > 0 &&
              <Collapsible defaultOpen={true} className="pt-3 border-t-2 mt-3">
                  <CollapsibleTrigger className="flex items-center justify-between w-full group bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3 hover:bg-[#F3F4F6] transition-colors">
                    <h4 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">Previous Visit Summaries ({jobSummaries.length})</h4>
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-3 space-y-3">
                    {jobSummaries.map((summary) =>
                  <div key={summary.id} className="bg-white border-2 border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-[#000000]">{summary.technician_name}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {format(new Date(summary.check_out_time), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        
                        {summary.outcome &&
                    <Badge className={`${outcomeColors[summary.outcome]} mb-3 font-semibold border-2 hover:opacity-100`}>
                            {summary.outcome?.replace(/_/g, ' ') || summary.outcome}
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
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Photos & Videos</h4>
                  {job.image_urls && job.image_urls.length > 0 && (
                    <Link 
                      to={`${createPageUrl("Photos")}?jobId=${job.id}`}
                      className="text-[12px] text-[#FAE008] hover:text-[#E5CF07] font-semibold flex items-center gap-1 transition-colors"
                    >
                      View in Library
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
                <EditableFileUpload
                  files={job.image_urls || []}
                  onFilesChange={handleImagesChange}
                  accept="image/*,video/*"
                  multiple={true}
                  icon={ImageIcon}
                  label=""
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

                <div className="pt-3 border-t-2">
                  <EditableFileUpload
                    files={job.other_documents || []}
                    onFilesChange={handleOtherDocumentsChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    multiple={true}
                    icon={FileText}
                    label="Other Documents"
                    emptyText="Upload documents" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chat" className="mt-2">
              <div className="space-y-3">
                <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Team Chat</h3>
                <p className="text-sm text-gray-600">Real-time messaging with assigned technicians and supervisors</p>
                <JobChat jobId={job.id} />
              </div>
            </TabsContent>

            <TabsContent value="map" className="mt-2">
              <div className="space-y-3">
                <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Job Location</h3>
                <JobMapView job={job} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
                    className="flex-1"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Open in Google Maps
                  </Button>
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
            <AlertDialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Delete Job?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-slate-600 leading-[1.4]">
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

      <CreateInvoiceModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onConfirm={(invoiceData) => createInvoiceMutation.mutate(invoiceData)}
        isSubmitting={createInvoiceMutation.isPending}
        type="job"
        data={{
          customer_name: job.customer_name,
          customer_email: job.customer_email,
          job_number: job.job_number,
          project_name: job.project_name
        }}
      />

      </>);

}