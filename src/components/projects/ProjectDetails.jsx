import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sameId } from "@/components/utils/id";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail, FileText, Image as ImageIcon, User, Upload, X, Briefcase, History, ExternalLink, DollarSign, Eye, Link2, MessageCircle, Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { AddIconButton } from "@/components/ui/AddIconButton";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import EditableField from "../jobs/EditableField";
import EditableFileUpload from "../jobs/EditableFileUpload";
import RichTextField from "../common/RichTextField";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import AddressAutocomplete from "../common/AddressAutocomplete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import ProjectChangeHistoryModal from "./ProjectChangeHistoryModal";
import ProjectStageSelector from "./ProjectStageSelector";
import PartsSection from "./PartsSection";
import LogisticsTimeline from "./LogisticsTimeline";
import ProjectSummary from "./ProjectSummary";
import ProjectVisitsTab from "./ProjectVisitsTab";
import FinancialsTab from "./FinancialsTab";
import FilePreviewModal from "../common/FilePreviewModal";
import XeroInvoiceCard from "../invoices/XeroInvoiceCard";
import CreateInvoiceModal from "../invoices/CreateInvoiceModal";
import TakePaymentModal from "../invoices/TakePaymentModal";
import WarrantyCard from "./WarrantyCard";
import MaintenanceSection from "./MaintenanceSection";
import DuplicateWarningCard, { DuplicateBadge } from "../common/DuplicateWarningCard";
import CustomerQuickEdit from "./CustomerQuickEdit";
import EntityModal from "../common/EntityModal";
import JobModalView from "../jobs/JobModalView";
import TasksPanel from "../tasks/TasksPanel";
import ProjectEmailSection from "./ProjectEmailSection";
import QuotesSection from "../quotes/QuotesSection";
import InitialVisitSummary from "./InitialVisitSummary";
import JobVisitSummary from "../jobs/JobVisitSummary";
import MarkAsLostModal from "./MarkAsLostModal";
import LinkInvoiceModal from "../invoices/LinkInvoiceModal";
import ProjectChatModal from "./ProjectChatModal";
import { PROJECT_STAGE_AUTOMATION } from "@/components/domain/projectStageAutomationConfig";
import ProjectPartsPanel from "./ProjectPartsPanel";
import HandoverReportModal from "../handover/HandoverReportModal";
import ProjectContactsPanel from "./ProjectContactsPanel";
import ThirdPartyTradesPanel from "./ThirdPartyTradesPanel";
import BackButton from "../common/BackButton";
import { getProjectFreshnessBadge } from "../utils/freshness";
import DocumentListItem from "./DocumentListItem";
import LastActivityCard from "./LastActivityCard";
import SamplesAtClientPanel from "./SamplesAtClientPanel";
import AttentionItemsPanel from "../attention/AttentionItemsPanel";
import MediaDocumentsDrawer from "./MediaDocumentsDrawer";

const statusColors = {
  "Lead": "bg-slate-100 text-slate-700",
  "Initial Site Visit": "bg-blue-100 text-blue-700",
  "Create Quote": "bg-violet-100 text-violet-700",
  "Quote Sent": "bg-purple-100 text-purple-700",
  "Quote Approved": "bg-indigo-100 text-indigo-700",
  "Final Measure": "bg-cyan-100 text-cyan-700",
  "Parts Ordered": "bg-amber-100 text-amber-700",
  "Scheduled": "bg-blue-100 text-blue-700",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Warranty": "bg-red-100 text-red-700",
  "Lost": "bg-red-100 text-red-700"
};

const financialStatusColors = {
  "50% payment made": "bg-yellow-100 text-yellow-800",
  "30% payment made (install)": "bg-orange-100 text-orange-800",
  "Balance paid in full": "bg-green-100 text-green-800"
};

const projectTypeColors = {
  "Garage Door Install": "bg-blue-100 text-blue-700",
  "Gate Install": "bg-green-100 text-green-700",
  "Roller Shutter Install": "bg-purple-100 text-purple-700",
  "Multiple": "bg-pink-100 text-pink-700",
  "Motor/Accessory": "bg-cyan-100 text-cyan-700",
  "Repair": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-indigo-100 text-indigo-700"
};

const jobStatusColors = {
  "Open": "bg-slate-100 text-slate-700",
  "Scheduled": "bg-blue-100 text-blue-700",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Cancelled": "bg-red-100 text-red-700"
};

export default function ProjectDetails({ project: initialProject, onClose, onEdit, onDelete, emailThreadId: propsEmailThreadId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [newDoor, setNewDoor] = useState({ height: "", width: "", type: "", style: "" });
  const [showAddDoor, setShowAddDoor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [previewJob, setPreviewJob] = useState(null);
  const [showLostModal, setShowLostModal] = useState(false);
  const [isMarkingLost, setIsMarkingLost] = useState(false);
  const [showLinkInvoiceModal, setShowLinkInvoiceModal] = useState(false);
  const [isLinkingInvoice, setIsLinkingInvoice] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadChat, setLastReadChat] = useState(() => localStorage.getItem(`lastReadChat-${initialProject.id}`) || new Date().toISOString());
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [isGeneratingHandover, setIsGeneratingHandover] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [visitsOpen, setVisitsOpen] = useState(true);
  const [mediaDocsOpen, setMediaDocsOpen] = useState(false);
  const [showAllContactsModal, setShowAllContactsModal] = useState(false);
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);
  const [mediaDrawerTab, setMediaDrawerTab] = useState("photos");
  const addTradeRef = React.useRef(null);

  // Get email thread ID from props, URL params, or project's source
  const urlParams = new URLSearchParams(window.location.search);
  const emailThreadId = propsEmailThreadId || urlParams.get('fromEmail') || initialProject?.source_email_thread_id;

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        // Error loading user
      }
    };
    loadUser();
  }, []);

  // Permission checks
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isTechnician = user?.is_field_technician && !isAdminOrManager;
  const isViewer = user?.role === 'viewer';
  const canEdit = isAdminOrManager;
  const canDelete = isAdminOrManager;
  const canChangeStage = isAdminOrManager;
  const canCreateJobs = isAdminOrManager;
  const canViewFinancials = isAdminOrManager;

  const { data: project = initialProject } = useQuery({
    queryKey: ['project', initialProject.id],
    queryFn: () => base44.entities.Project.get(initialProject.id),
    initialData: initialProject
  });

  const [description, setDescription] = useState(project.description || "");
  const [notes, setNotes] = useState(project.notes || "");

  React.useEffect(() => {
    setDescription(project.description || "");
    setNotes(project.notes || "");
  }, [project.description, project.notes]);

  const { data: jobs = [] } = useQuery({
    queryKey: ['projectJobs', project.id],
    queryFn: async () => {
      const projectJobs = await base44.entities.Job.filter({ project_id: project.id });
      return projectJobs.filter(job => !job.deleted_at);
    },
    refetchInterval: 5000,
    enabled: !!project.id
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['projectParts', project.id],
    queryFn: () => base44.entities.Part.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list(),
  });

  const { data: inventoryQuantities = [] } = useQuery({
    queryKey: ['inventoryQuantities'],
    queryFn: () => base44.entities.InventoryQuantity.list(),
  });

  const inventoryByItem = React.useMemo(() => {
    const map = {};
    for (const item of priceListItems) {
      map[item.id] = (map[item.id] || 0) + (item.stock_level || 0);
    }
    for (const iq of inventoryQuantities) {
      if (iq.price_list_item_id && iq.location_type === 'vehicle') {
        map[iq.price_list_item_id] = (map[iq.price_list_item_id] || 0) + (iq.quantity_on_hand || 0);
      }
    }
    return map;
  }, [priceListItems, inventoryQuantities]);

  const { data: customer } = useQuery({
    queryKey: ['customer', project.customer_id],
    queryFn: () => base44.entities.Customer.get(project.customer_id),
    enabled: !!project.customer_id
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const { data: activeViewers = [] } = useQuery({
    queryKey: ['projectViewers', project.id],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        const viewers = await base44.entities.ProjectViewer.filter({ project_id: project.id });
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        return viewers.filter(v => v.last_seen > oneMinuteAgo && v.user_email !== user.email);
      } catch (error) {
        return [];
      }
    },
    refetchInterval: 10000
  });

  const { data: chatMessages = [] } = useQuery({
    queryKey: ['projectMessages', project.id],
    queryFn: () => base44.entities.ProjectMessage?.filter({ project_id: project.id }, 'created_date') || [],
    refetchInterval: 10000,
    enabled: !!project.id
  });

  const hasNewMessages = chatMessages.some(m => 
    new Date(m.created_date) > new Date(lastReadChat) && 
    m.sender_email !== user?.email
  );

  const handleChatOpenChange = (open) => {
    setIsChatOpen(open);
    if (open) {
      const now = new Date().toISOString();
      setLastReadChat(now);
      localStorage.setItem(`lastReadChat-${project.id}`, now);
    }
  };

  const { data: handoverReports = [] } = useQuery({
    queryKey: ["handover-reports", project.id],
    queryFn: () => base44.entities.HandoverReport.filter({ project_id: project.id }),
    enabled: !!project?.id,
  });

  const { data: projectContacts = [] } = useQuery({
    queryKey: ['projectContacts', project.id],
    queryFn: () => base44.entities.ProjectContact.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: tradeRequirements = [] } = useQuery({
    queryKey: ['projectTrades', project.id],
    queryFn: () => base44.entities.ProjectTradeRequirement.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['projectTasks', project.id],
    queryFn: () => base44.entities.Task.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  // Auto-expand panels based on content
  React.useEffect(() => {
    if (projectContacts.length > 0 && !contactsOpen) setContactsOpen(true);
    if (tradeRequirements.length > 0 && !tradesOpen) setTradesOpen(true);
    if (((project.image_urls && project.image_urls.length > 0) || project.quote_url || project.invoice_url || (project.other_documents && project.other_documents.length > 0) || handoverReports.length > 0) && !mediaDocsOpen) setMediaDocsOpen(true);
  }, [projectContacts, tradeRequirements, project.image_urls, project.quote_url, project.invoice_url, project.other_documents, handoverReports]);

  const { data: xeroInvoices = [] } = useQuery({
    queryKey: ['projectXeroInvoices', project.id],
    queryFn: async () => {
      // Fetch all invoices linked to this project via project_id
      const allInvoices = await base44.entities.XeroInvoice.filter({ project_id: project.id });
      
      // Deduplicate by xero_invoice_id (in case duplicates were created)
      const uniqueInvoices = allInvoices.reduce((acc, inv) => {
        if (!acc.find(i => sameId(i.xero_invoice_id, inv.xero_invoice_id))) {
          acc.push(inv);
        }
        return acc;
      }, []);
      
      return uniqueInvoices;
    },
    enabled: !!project.id
  });

  React.useEffect(() => {
    let viewerRecordId = null;
    const updatePresence = async () => {
      try {
        const user = await base44.auth.me();
        const viewerData = {
          project_id: project.id,
          user_email: user.email,
          user_name: user.full_name,
          last_seen: new Date().toISOString()
        };

        if (viewerRecordId) {
          try {
            await base44.entities.ProjectViewer.update(viewerRecordId, viewerData);
          } catch (error) {
            const newViewer = await base44.entities.ProjectViewer.create(viewerData);
            viewerRecordId = newViewer.id;
          }
        } else {
          const newViewer = await base44.entities.ProjectViewer.create(viewerData);
          viewerRecordId = newViewer.id;
        }
      } catch (error) {
        // Error updating presence
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000);

    return () => {
      clearInterval(interval);
      if (viewerRecordId) {
        base44.entities.ProjectViewer.delete(viewerRecordId).catch(() => {});
      }
    };
  }, [project.id]);

  const updateProjectMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Project.update(project.id, { [field]: value }),
    onSuccess: (data, variables) => {
      // Optimistically update the cache with the new value
      queryClient.setQueryData(['project', project.id], (oldData) => ({
        ...oldData,
        [variables.field]: variables.value
      }));
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['allProjects'] });
    }
  });

  const updateProjectFieldsMutation = useMutation({
    mutationFn: (fields) => base44.entities.Project.update(project.id, fields),
    onSuccess: (data, fields) => {
      // Optimistically update the cache with all new values
      queryClient.setQueryData(['project', project.id], (oldData) => ({
        ...oldData,
        ...fields
      }));
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['allProjects'] });
    }
  });

  const createProjectInvoiceMutation = useMutation({
    mutationFn: async (invoiceData) => {
      const response = await base44.functions.invoke('createInvoiceFromProject', { 
        project_id: project.id,
        lineItems: invoiceData.lineItems,
        total: invoiceData.total
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectXeroInvoices', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      setShowInvoiceModal(false);
      toast.success(`Invoice #${data.xero_invoice_number} created successfully in Xero`);
    },
    onError: (error) => {
      console.error('Invoice creation error:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      toast.error(`Failed to create invoice: ${errorMsg}`);
    }
  });

  const syncProjectInvoiceMutation = useMutation({
    mutationFn: async (invoiceId) => {
      const response = await base44.functions.invoke('syncXeroInvoiceStatus', { 
        invoice_id: invoiceId 
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectXeroInvoices', project.id] });
      if (data.voided) {
        toast.info('Invoice was voided in Xero and removed from the app');
      }
    }
  });

  const handleLinkExistingInvoice = async (invoice) => {
    setIsLinkingInvoice(true);
    try {
      // Check if this invoice is already linked
      const existing = await base44.entities.XeroInvoice.filter({ 
        xero_invoice_id: invoice.xero_invoice_id,
        project_id: project.id
      });

      if (existing.length > 0 || xeroInvoices.some(x => sameId(x.xero_invoice_id, invoice.xero_invoice_id))) {
        toast.info('This invoice is already linked to this project');
        setShowLinkInvoiceModal(false);
        setIsLinkingInvoice(false);
        return;
      }

      // Create XeroInvoice record linking to this project
      await base44.entities.XeroInvoice.create({
        xero_invoice_id: invoice.xero_invoice_id,
        xero_invoice_number: invoice.xero_invoice_number,
        status: invoice.status,
        total: invoice.total,
        total_amount: invoice.total,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        date: invoice.date,
        due_date: invoice.due_date,
        contact_name: invoice.contact_name,
        contact_id: invoice.contact_id,
        pdf_url: invoice.pdf_url,
        online_payment_url: invoice.online_payment_url,
        project_id: project.id
      });

      queryClient.invalidateQueries({ queryKey: ['projectXeroInvoices', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success(`Invoice #${invoice.xero_invoice_number} linked to project`);
      setShowLinkInvoiceModal(false);
    } catch (error) {
      toast.error('Failed to link invoice');
    } finally {
      setIsLinkingInvoice(false);
    }
  };



  const handleAddJob = () => {
    navigate(createPageUrl("Jobs") + `?action=new&projectId=${project.id}`);
  };

  const handleJobClick = (jobId) => {
    navigate(createPageUrl("Jobs") + `?jobId=${jobId}`);
  };

  const handleCustomerClick = () => {
    if (customer) {
      navigate(createPageUrl("Customers") + `?customerId=${customer.id}`);
    }
  };

  const handleFieldSave = async (fieldName, oldValue, newValue) => {
    if (oldValue !== newValue) {
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: fieldName,
        old_value: String(oldValue),
        new_value: String(newValue),
        changed_by: user.email,
        changed_by_name: user.full_name
      });
    }
    updateProjectMutation.mutate({ field: fieldName, value: newValue });
  };

  const handleApplyAISuggestions = async (fieldsToApply, sourceEmailThreadId) => {
    try {
      const currentUser = await base44.auth.me();
      
      // Update project with suggested fields
      const updatePromises = Object.entries(fieldsToApply).map(([field, value]) => {
        return base44.entities.Project.update(project.id, { [field]: value });
      });
      
      await Promise.all(updatePromises);

      // Log the AI update in change history
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'ai_fields_applied',
        old_value: '',
        new_value: `Fields updated from AI analysis of Email Thread`,
        changed_by: currentUser.email,
        changed_by_name: currentUser.full_name
      });

      // Link the email thread to the project if not already linked
      if (sourceEmailThreadId && !project.source_email_thread_id) {
        await base44.entities.Project.update(project.id, {
          source_email_thread_id: sourceEmailThreadId
        });
      }

      // Mark the AI insight as applied
      const insights = await base44.entities.AIEmailInsight.filter({ email_thread_id: sourceEmailThreadId });
      if (insights.length > 0) {
        await base44.entities.AIEmailInsight.update(insights[0].id, {
          project_id: project.id,
          applied_to_project: true,
          applied_at: new Date().toISOString()
        });
      }

      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('AI suggestions applied to project');
    } catch (error) {
      toast.error('Failed to apply AI suggestions');
    }
  };

  const handleStageChange = async (newStage) => {
    const oldStage = project.status;
    
    // Save the stage change first
    await handleFieldSave('status', oldStage, newStage);

    // Look up automation rules for this stage
    const stageRule = PROJECT_STAGE_AUTOMATION[newStage] || {
      handleCompletion: false,
      autoJobs: []
    };

    // Handle project completion warranty logic based on config
    if (stageRule.handleCompletion && oldStage !== newStage) {
      try {
        await base44.functions.invoke('handleProjectCompletion', {
          project_id: project.id,
          new_status: newStage,
          old_status: oldStage,
          completed_date: project.completed_date || new Date().toISOString().split('T')[0]
        });
        queryClient.invalidateQueries({ queryKey: ['project', project.id] });
        queryClient.invalidateQueries({ queryKey: ['maintenanceReminders', project.id] });
        toast.success('Project completed and warranty activated');
      } catch (error) {
        // Error handling project completion
      }
    }

    // Auto-create jobs based on stage
    const autoCreateJob = async (jobTypeName) => {
      // Check if job type already exists for this project
      const existingJob = jobs.find(j => sameId(j.job_type_name, jobTypeName));
      if (existingJob) {
        // Job already exists, navigate to it
        handleJobClick(existingJob.id);
        return;
      }

      // Fetch job types to get the ID
      const jobTypes = await base44.entities.JobType.list();
      const jobType = jobTypes.find(jt => sameId(jt.name, jobTypeName));
      
      if (!jobType) {
        // JobType not found
      }
      
      // Get the latest job number
      const allJobs = await base44.entities.Job.list('-job_number', 1);
      const nextJobNumber = allJobs.length > 0 ? (allJobs[0].job_number || 5000) + 1 : 5000;

      // Build installation details text
      let installationDetails = '';
      if (project.doors && project.doors.length > 0) {
        installationDetails = '\n\n**Installation Details:**\n';
        project.doors.forEach((door, idx) => {
          installationDetails += `\nDoor ${idx + 1}:`;
          if (door.height && door.width) installationDetails += ` ${door.height} × ${door.width}`;
          if (door.type) installationDetails += ` • ${door.type}`;
          if (door.style) installationDetails += ` • ${door.style}`;
        });
      }

      // Map project type to product
      let product = null;
      if (project.project_type === "Garage Door Install") {
        product = "Garage Door";
      } else if (project.project_type === "Gate Install") {
        product = "Gate";
      } else if (project.project_type === "Roller Shutter Install") {
        product = "Roller Shutter";
      } else if (project.project_type === "Multiple") {
        product = "Multiple";
      }

      // Generate AI overview
      let additionalInfo = '';
      try {
        const prompt = `Based on this project information, create a concise bullet-point overview for this ${jobTypeName} job:

Project Title: ${project.title}
Project Type: ${project.project_type || 'N/A'}
Description: ${project.description || 'No description provided'}
${installationDetails}

Format as HTML bullet points using <ul> and <li> tags. Include only the most critical information the technician needs. Keep it brief - 3-5 bullet points maximum.`;

        const aiResponse = await base44.integrations.Core.InvokeLLM({
          prompt: prompt,
          add_context_from_internet: false
        });

        // Strip markdown code fences if present
        additionalInfo = aiResponse.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();
        
        // Add installation details if present
        if (installationDetails) {
          additionalInfo += `<br><br><strong>Installation Details:</strong><ul>`;
          project.doors.forEach((door, idx) => {
            let doorInfo = `Door ${idx + 1}:`;
            if (door.height && door.width) doorInfo += ` ${door.height} × ${door.width}`;
            if (door.type) doorInfo += ` • ${door.type}`;
            if (door.style) doorInfo += ` • ${door.style}`;
            additionalInfo += `<li>${doorInfo}</li>`;
          });
          additionalInfo += `</ul>`;
        }
      } catch (error) {
        // Fallback if AI fails
        additionalInfo = (project.description || '').replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();
        if (installationDetails) {
          additionalInfo += `<br><br><strong>Installation Details:</strong><ul>`;
          project.doors.forEach((door, idx) => {
            let doorInfo = `Door ${idx + 1}:`;
            if (door.height && door.width) doorInfo += ` ${door.height} × ${door.width}`;
            if (door.type) doorInfo += ` • ${door.type}`;
            if (door.style) doorInfo += ` • ${door.style}`;
            additionalInfo += `<li>${doorInfo}</li>`;
          });
          additionalInfo += `</ul>`;
        }
      }

      // Create the job with project data using manageJob function to trigger automation
      const createJobResponse = await base44.functions.invoke('manageJob', { 
        action: 'create', 
        data: {
          job_number: nextJobNumber,
          project_id: project.id,
          project_name: project.title,
          customer_id: project.customer_id,
          customer_name: project.customer_name,
          customer_phone: project.customer_phone,
          customer_email: project.customer_email,
          address: project.address,
          product: product,
          job_type_id: jobType?.id || null,
          job_type_name: jobTypeName,
          status: jobTypeName === "Installation" && newStage === "Scheduled" ? "Scheduled" : "Open",
          scheduled_date: new Date().toISOString().split('T')[0],
          additional_info: additionalInfo,
          image_urls: project.image_urls || [],
          quote_url: project.quote_url || null,
          invoice_url: project.invoice_url || null
        }
      });
      
      const newJob = createJobResponse.data.job;

      // Log the auto-creation in change history
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'auto_created_job',
        old_value: '',
        new_value: `${jobTypeName} (Job #${nextJobNumber})`,
        changed_by: user.email,
        changed_by_name: user.full_name
      });

      // Refresh jobs and navigate to the new job
      await queryClient.invalidateQueries({ queryKey: ['projectJobs', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      
      // Small delay to ensure queries have refetched
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Navigate to the new job
      navigate(createPageUrl("Jobs") + `?jobId=${newJob.id}`);
    };

    // Stage-based automation driven by config
    if (Array.isArray(stageRule.autoJobs) && stageRule.autoJobs.length > 0) {
      for (const jobRule of stageRule.autoJobs) {
        if (jobRule?.jobTypeName) {
          await autoCreateJob(jobRule.jobTypeName);
        }
      }
    }
  };

  const handleMarkAsLost = async (lostData) => {
    setIsMarkingLost(true);
    try {
      const currentUser = await base44.auth.me();
      
      // Update project status to Lost with reason
      await base44.entities.Project.update(project.id, {
        status: "Lost",
        lost_reason: lostData.lost_reason,
        lost_reason_notes: lostData.lost_reason_notes,
        lost_date: lostData.lost_date
      });

      // Log the change
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'status',
        old_value: project.status,
        new_value: `Lost - ${lostData.lost_reason}${lostData.lost_reason_notes ? ` (${lostData.lost_reason_notes})` : ''}`,
        changed_by: currentUser.email,
        changed_by_name: currentUser.full_name
      });

      // Cancel all open/scheduled jobs
      const openJobs = jobs.filter(j => j.status === "Open" || j.status === "Scheduled");
      await Promise.all(openJobs.map(job => 
        base44.entities.Job.update(job.id, { status: "Cancelled" })
      ));

      // Cancel all open tasks related to this project
      const projectTasks = await base44.entities.Task.filter({ 
        project_id: project.id 
      });
      const openProjectTasks = projectTasks.filter(t => t.status !== "Completed" && t.status !== "Cancelled");
      
      // Cancel all open tasks related to jobs in this project
      const jobIds = jobs.map(j => j.id);
      let jobTasks = [];
      if (jobIds.length > 0) {
        const allJobTasks = await Promise.all(
          jobIds.map(jobId => base44.entities.Task.filter({ job_id: jobId }))
        );
        jobTasks = allJobTasks.flat().filter(t => t.status !== "Completed" && t.status !== "Cancelled");
      }

      // Cancel all found open tasks
      const allOpenTasks = [...openProjectTasks, ...jobTasks];
      await Promise.all(allOpenTasks.map(task => 
        base44.entities.Task.update(task.id, { status: "Cancelled" })
      ));

      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectJobs', project.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      const cancelledCount = openJobs.length + allOpenTasks.length;
      toast.success(`Project marked as lost. ${openJobs.length} job${openJobs.length !== 1 ? 's' : ''} and ${allOpenTasks.length} task${allOpenTasks.length !== 1 ? 's' : ''} cancelled.`);
      setShowLostModal(false);
    } catch (error) {
      toast.error('Failed to mark project as lost');
    } finally {
      setIsMarkingLost(false);
    }
  };

  const handleDescriptionBlur = async () => {
    if (description !== project.description) {
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'description',
        old_value: String(project.description || ''),
        new_value: String(description),
        changed_by: user.email,
        changed_by_name: user.full_name
      });
      updateProjectMutation.mutate({ field: 'description', value: description });
    }
  };

  const handleNotesBlur = async () => {
    if (notes !== project.notes) {
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'notes',
        old_value: String(project.notes || ''),
        new_value: String(notes),
        changed_by: user.email,
        changed_by_name: user.full_name
      });
      updateProjectMutation.mutate({ field: 'notes', value: notes });
    }
  };

  const handleTechniciansChange = (emails) => {
    const emailsArray = Array.isArray(emails) ? emails : [];
    const techNames = emailsArray.map(email => {
      const tech = technicians.find(t => sameId(t.email, email));
      return tech?.full_name || "";
    }).filter(Boolean);
    
    const updates = {
      assigned_technicians: emailsArray,
      assigned_technicians_names: techNames
    };
    
    base44.entities.Project.update(project.id, updates).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['allProjects'] });
      queryClient.setQueryData(['project', project.id], (oldData) => ({
        ...oldData,
        ...updates
      }));
    });
  };

  const handleFileUpload = async (event, type) => {
    const files = (type === 'other' || type === 'image') 
      ? Array.from(event.target.files || []) 
      : [event.target.files?.[0]];
    if (files.length === 0 || !files[0]) return;

    setUploading(true);
    try {
      if (type === 'other') {
        const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
        const results = await Promise.all(uploadPromises);
        const newDocs = results.map((r, idx) => ({
          url: r.file_url,
          name: files[idx].name
        }));
        const currentDocs = project.other_documents || [];
        updateProjectMutation.mutate({ 
          field: 'other_documents', 
          value: [...currentDocs, ...newDocs] 
        });
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: files[0] });
        
        if (type === 'quote') {
          updateProjectMutation.mutate({ field: 'quote_url', value: file_url });
        } else if (type === 'invoice') {
          updateProjectMutation.mutate({ field: 'invoice_url', value: file_url });
        }
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleImagesChange = async (urls) => {
    // Find removed images and delete corresponding Photo records
    const currentUrls = project.image_urls || [];
    const removedUrls = currentUrls.filter(url => !urls.includes(url));

    if (removedUrls.length > 0) {
      try {
        const photos = await base44.entities.Photo.filter({ project_id: project.id });
        const photosToDelete = photos.filter(p => removedUrls.includes(p.image_url));
        
        if (photosToDelete.length > 0) {
          await Promise.all(photosToDelete.map(p => base44.entities.Photo.delete(p.id)));
          queryClient.invalidateQueries({ queryKey: ['photos'] });
          toast.success(`Deleted ${photosToDelete.length} photo(s)`);
        }
      } catch (error) {
        // Error deleting photo records
      }
    }

    // Update project with new images
    updateProjectMutation.mutate({ field: 'image_urls', value: urls });
  };

  const handleAddDoor = () => {
    if (!newDoor.height && !newDoor.width && !newDoor.type) return;
    
    const currentDoors = project.doors || [];
    updateProjectMutation.mutate({ 
      field: 'doors', 
      value: [...currentDoors, newDoor] 
    });
    setNewDoor({ height: "", width: "", type: "", style: "" });
    setShowAddDoor(false);
  };

  const handleRemoveDoor = (indexToRemove) => {
    const updatedDoors = project.doors.filter((_, index) => index !== indexToRemove);
    updateProjectMutation.mutate({ field: 'doors', value: updatedDoors });
  };

  const isInstallType = project.project_type && project.project_type.includes("Install");

  React.useEffect(() => {
    // Auto-focus tabs based on project stage
    if (project.status === "Completed") {
      setActiveTab("summary");
    } else if (project.status === "Lead" || project.status === "Initial Site Visit") {
      setActiveTab("overview");
    } else if (project.status === "Create Quote" || project.status === "Quote Sent" || project.status === "Quote Approved") {
      setActiveTab("quoting");
    } else if (project.status === "Parts Ordered") {
      setActiveTab("parts");
    } else if (project.status === "Scheduled") {
      setActiveTab("overview"); // Stay on overview but jobs list is visible in sidebar
    }
  }, [project.status]);

  const freshness = getProjectFreshnessBadge(project);
  
  const freshnessColors = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700"
  };

  // Calculate command bar counts
  const mediaCount = (project.image_urls || []).length;
  const docsCount = [
    project.quote_url,
    project.invoice_url,
    project.handover_pdf_url,
    ...(project.other_documents || [])
  ].filter(Boolean).length + (handoverReports.length > 0 ? 1 : 0);
  const tasksCount = projectTasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length;
  const unreadCommsCount = chatMessages.filter(m => 
    new Date(m.created_date) > new Date(lastReadChat) && 
    m.sender_email !== user?.email
  ).length;

  return (
    <div className="relative flex flex-col lg:flex-row gap-4 overflow-x-hidden items-start">
      {/* Customer Sidebar */}
      <aside className="w-full lg:w-72 flex-shrink-0 lg:sticky lg:top-4">
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
            <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Customer</h3>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <CustomerQuickEdit
              customerId={project.customer_id}
              projectId={project.id}
              onCustomerUpdate={(updatedData) => {
                queryClient.invalidateQueries({ queryKey: ['project', project.id] });
              }}
            />

            <div className="pt-3 border-t border-[#E5E7EB]">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[#6B7280] font-normal leading-[1.4] mb-0.5">Address</div>
                  <AddressAutocomplete
                    value={project.address_full || project.address}
                    onChange={(addressData) => {
                      // Update all address fields
                      base44.entities.Project.update(project.id, {
                        address: addressData.address_full,
                        address_full: addressData.address_full,
                        address_street: addressData.address_street,
                        address_suburb: addressData.address_suburb,
                        address_state: addressData.address_state,
                        address_postcode: addressData.address_postcode,
                        address_country: addressData.address_country,
                        google_place_id: addressData.google_place_id,
                        latitude: addressData.latitude,
                        longitude: addressData.longitude
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['project', project.id] });
                        queryClient.invalidateQueries({ queryKey: ['projects'] });
                      });
                    }}
                    placeholder="Search for address..."
                    className="text-[14px]"
                  />
                </div>
              </div>
            </div>
            </CardContent>
            </Card>

            {/* Project Contacts Section */}
            <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden mt-4">
              <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
                  Project Contacts
                  {projectContacts.length > 0 && (
                    <span className="text-[12px] font-normal text-[#6B7280] ml-2">
                      ({projectContacts.length})
                    </span>
                  )}
                </h3>
                {canEdit && (
                  <AddIconButton
                    onClick={() => {
                      // Trigger the add contact function from ProjectContactsPanel
                      window.dispatchEvent(new CustomEvent('addProjectContact', { detail: { projectId: project.id } }));
                    }}
                    title="Add Contact"
                  />
                )}
              </CardHeader>
              <CardContent className="p-4">
                {projectContacts.length === 0 ? (
                  <div className="text-center py-4 text-[14px] text-[#9CA3AF]">
                    No additional contacts
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectContacts.slice(0, 5).map((contact) => (
                      <div key={contact.id} className="pb-3 border-b border-[#E5E7EB] last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="font-medium text-[14px] text-[#111827]">
                            {contact.name}
                          </div>
                          {contact.role && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0">
                              {contact.role}
                            </Badge>
                          )}
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-[13px] text-[#6B7280] mb-1">
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                            <a href={`tel:${contact.phone}`} className="hover:text-[#111827] transition-colors">
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                            <a href={`mailto:${contact.email}`} className="hover:text-[#111827] transition-colors truncate">
                              {contact.email}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {projectContacts.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllContactsModal(true)}
                        className="w-full mt-2 text-[#111827] hover:bg-[#F3F4F6] text-[13px]"
                      >
                        View all {projectContacts.length} contacts
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
      </aside>

            {/* Main Content */}
            <div className="flex-1 w-full lg:min-w-0">
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="border-b border-[#E5E7EB] bg-white p-3 md:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BackButton to={createPageUrl("Projects")} />
            <Badge className={freshnessColors[freshness.color]}>
              {freshness.label}
            </Badge>
            <span className="text-[12px] text-[#6B7280] hidden sm:block">
              Age: {freshness.days !== null ? `${freshness.days} days` : 'Unknown'}
            </span>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            {activeViewers.length > 0 && (
              <div className="flex -space-x-2 mr-2">
                {activeViewers.map((viewer, idx) => (
                  <div
                    key={viewer.id}
                    className="w-8 h-8 bg-[#FAE008] rounded-full flex items-center justify-center border-2 border-white"
                    title={viewer.user_name}
                  >
                    <span className="text-[#111827] font-semibold text-xs">
                      {viewer.user_name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowActivityModal(true)}
              className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
              title="View Activity"
            >
              <Activity className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (project.handover_locked && project.handover_pdf_url) {
                  window.open(project.handover_pdf_url, '_blank');
                  return;
                }
                
                setIsGeneratingHandover(true);
                try {
                  const response = await base44.functions.invoke('generateProjectHandoverReport', {
                    projectId: project.id
                  });
                  
                  if (response.data.success && response.data.pdf_url) {
                    queryClient.invalidateQueries({ queryKey: ['project', project.id] });
                    toast.success('Handover report generated successfully');
                    window.open(response.data.pdf_url, '_blank');
                  }
                } catch (error) {
                  const errorMsg = error?.response?.data?.error || error.message;
                  toast.error(`Failed to generate handover: ${errorMsg}`);
                } finally {
                  setIsGeneratingHandover(false);
                }
              }}
              disabled={isGeneratingHandover}
              className="h-9 text-xs"
            >
              {isGeneratingHandover ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Generating...
                </>
              ) : project.handover_locked && project.handover_pdf_url ? (
                'View Handover Report'
              ) : (
                'Generate Handover Report'
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(true)}
              className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
            >
              <History className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleChatOpenChange(true)}
              className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg relative"
            >
              <MessageCircle className="w-4 h-4" />
              {hasNewMessages && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(project)}
                className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-bold text-[#000000]">Delete Project?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600">
                    This project will be moved to the archive. Associated jobs will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(project.id)}
                    className="bg-red-600 hover:bg-red-700 rounded-xl font-semibold"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
          </div>
        </div>

        {/* Command Bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#F9FAFB] border-y border-[#E5E7EB] overflow-x-auto">
          <button
            onClick={() => {
              setMediaDrawerTab("photos");
              setMediaDrawerOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all whitespace-nowrap"
          >
            <ImageIcon className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[13px] font-medium text-[#111827]">Media</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-[#E5E7EB] text-[#4B5563]">
              {mediaCount}
            </Badge>
          </button>
          
          <button
            onClick={() => {
              setMediaDrawerTab("documents");
              setMediaDrawerOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[13px] font-medium text-[#111827]">Docs</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-[#E5E7EB] text-[#4B5563]">
              {docsCount}
            </Badge>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('overview');
              setTimeout(() => {
                document.getElementById('tasks-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all whitespace-nowrap"
          >
            <Briefcase className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[13px] font-medium text-[#111827]">Tasks</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-[#E5E7EB] text-[#4B5563]">
              {tasksCount}
            </Badge>
          </button>
          
          <button
            onClick={() => setActiveTab('emails')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all whitespace-nowrap relative"
          >
            <MessageCircle className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[13px] font-medium text-[#111827]">Comms</span>
            <Badge 
              variant="secondary" 
              className={`ml-1 px-1.5 py-0 text-[10px] ${unreadCommsCount > 0 ? 'bg-red-100 text-red-700' : 'bg-[#E5E7EB] text-[#4B5563]'}`}
            >
              {unreadCommsCount}
            </Badge>
            {unreadCommsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
                {project.title}
              </h2>
              <DuplicateBadge record={project} />
            </div>
            {project.contract_id && (
              <Link to={createPageUrl("Contracts")}>
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 cursor-pointer border-purple-200 font-medium text-[12px] leading-[1.35] px-2.5 py-0.5 rounded-lg">
                  Contract Job
                </Badge>
              </Link>
            )}
            {project.project_type && (
              <EditableField
                value={project.project_type}
                onSave={(val) => handleFieldSave('project_type', project.project_type, val)}
                type="select"
                options={[
                  { value: "Garage Door Install", label: "Garage Door Install" },
                  { value: "Gate Install", label: "Gate Install" },
                  { value: "Roller Shutter Install", label: "Roller Shutter Install" },
                  { value: "Multiple", label: "Multiple" },
                  { value: "Motor/Accessory", label: "Motor/Accessory" },
                  { value: "Repair", label: "Repair" },
                  { value: "Maintenance", label: "Maintenance" }
                ]}
                displayFormat={(val) => (
                  <Badge className={`${projectTypeColors[val]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35] hover:opacity-100`}>
                    {val}
                  </Badge>
                )}
              />
            )}
          </div>



          <div className="bg-white p-3 rounded-lg border border-[#E5E7EB] overflow-hidden">
            <div className="text-[12px] font-medium text-[#4B5563] leading-[1.35] mb-2 uppercase tracking-wide">Project Stage</div>
            <ProjectStageSelector
              currentStage={project.status}
              onStageChange={canChangeStage ? handleStageChange : undefined}
              onMarkAsLost={canChangeStage ? () => setShowLostModal(true) : undefined}
              disabled={!canChangeStage}
            />
            {project.status === "Lost" && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-[13px] font-medium text-red-700">Lost Reason:</span>
                  <span className="text-[13px] text-red-600">
                    {project.lost_reason}
                    {project.lost_reason_notes && ` - ${project.lost_reason_notes}`}
                  </span>
                </div>
                {project.lost_date && (
                  <div className="text-[12px] text-red-500 mt-1">
                    Lost on {new Date(project.lost_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            )}
          </div>
          {project.financial_status && (
            <div className="mt-2">
              <EditableField
                value={project.financial_status}
                onSave={(val) => handleFieldSave('financial_status', project.financial_status, val)}
                type="select"
                options={[
                  { value: "50% payment made", label: "50% payment made" },
                  { value: "30% payment made (install)", label: "30% payment made (install)" },
                  { value: "Balance paid in full", label: "Balance paid in full" }
                ]}
                displayFormat={(val) => (
                  <Badge className={`${financialStatusColors[val]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35] hover:opacity-100`}>
                    {val}
                  </Badge>
                )}
              />
            </div>
          )}
          </div>
        </CardHeader>

      <CardContent className="p-3 md:p-4">
        {/* Attention Items Panel */}
        <AttentionItemsPanel
          entity_type="project"
          entity_id={project.id}
          context_ids={{
            customer_id: project.customer_id,
            project_id: project.id,
            job_id: null
          }}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="sticky top-0 z-10 bg-white pb-3">
              <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 mb-3">
                <TabsList className="w-full justify-start min-w-max md:min-w-0">
                  <TabsTrigger value="overview" className="flex-1 whitespace-nowrap">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="emails" className="flex-1 whitespace-nowrap">Emails</TabsTrigger>
                  <TabsTrigger value="quoting" className="flex-1 whitespace-nowrap">Quoting</TabsTrigger>
                  <TabsTrigger value="parts" className="flex-1 whitespace-nowrap">Parts</TabsTrigger>
                  <TabsTrigger value="invoices" className="flex-1 whitespace-nowrap">Invoices</TabsTrigger>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <TabsTrigger value="financials" className="flex-1 whitespace-nowrap">Financials</TabsTrigger>
                  )}
                  <TabsTrigger value="summary" className="flex-1 whitespace-nowrap">
                    Summary
                  </TabsTrigger>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <TabsTrigger value="warranty" className="flex-1 whitespace-nowrap">Warranty</TabsTrigger>
                  )}
                </TabsList>
              </div>

              {/* Tasks Section - Sticky Below Tabs */}
              <div id="tasks-panel" className="border border-[#E5E7EB] rounded-lg bg-white shadow-sm">
                <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
                  <CollapsibleTrigger className="w-full">
                    <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
                      <h3 className="text-[14px] font-semibold text-[#111827]">Tasks</h3>
                      <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${tasksOpen ? 'transform rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 border-t border-[#E5E7EB]">
                      <TasksPanel
                        entityType="project"
                        entityId={project.id}
                        entityName={project.title}
                        compact={true}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

          <TabsContent value="overview" className="space-y-3 mt-3">
            {/* Duplicate Warning */}
            <DuplicateWarningCard entityType="Project" record={project} />

            {/* Prior Job Summaries */}
            {jobs
              .filter(j => j.status === "Completed" && (j.overview || j.next_steps || j.communication_with_client || j.measurements || (j.image_urls && j.image_urls.length > 0)))
              .sort((a, b) => new Date(a.updated_date || a.created_date) - new Date(b.updated_date || b.created_date))
              .map((job, idx) => {
                const colors = ["blue", "green", "purple", "orange", "cyan"];
                const color = colors[idx % colors.length];
                return (
                  <JobVisitSummary 
                    key={job.id}
                    job={job}
                    title={job.job_type_name || `Job #${job.job_number}`}
                    borderColor={color}
                  />
                );
              })
            }

            <div>
              <RichTextField
                label="Description"
                value={description}
                onChange={setDescription}
                onBlur={handleDescriptionBlur}
                placeholder="Add a clear summary of this project…"
              />
            </div>

            <div>
              <RichTextField
                label="Notes"
                value={notes}
                onChange={setNotes}
                onBlur={handleNotesBlur}
                placeholder="Add any extra notes or context for the team…"
                helperText="Internal only"
              />
            </div>

            {isInstallType && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563]">
                    Measurements Provided
                  </label>
                  {!showAddDoor && (
                    <AddIconButton
                      onClick={() => setShowAddDoor(true)}
                      title="Add Door"
                    />
                  )}
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-[#E5E7EB]">
                  {project.doors && project.doors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {project.doors.map((door, idx) => (
                        <div key={idx} className="relative group">
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 font-medium px-3 py-1.5 text-sm pr-8">
                            Door {idx + 1}: {door.height && door.width ? `${door.height} × ${door.width}` : 'Pending specs'}
                            {door.type && ` • ${door.type}`}
                            {door.style && ` • ${door.style}`}
                          </Badge>
                          <button
                            onClick={() => handleRemoveDoor(idx)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : !showAddDoor && (
                    <p className="text-[14px] text-[#9CA3AF]">No doors added yet</p>
                  )}
                  
                  {showAddDoor && (
                    <div className="border border-[#E5E7EB] rounded-lg p-3 bg-[#F8F9FA] mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        <Input
                          placeholder="Height"
                          value={newDoor.height}
                          onChange={(e) => setNewDoor({ ...newDoor, height: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                        <Input
                          placeholder="Width"
                          value={newDoor.width}
                          onChange={(e) => setNewDoor({ ...newDoor, width: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                        <Input
                          placeholder="Type (e.g. Sectional, Roller)"
                          value={newDoor.type}
                          onChange={(e) => setNewDoor({ ...newDoor, type: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                        <Input
                          placeholder="Style"
                          value={newDoor.style}
                          onChange={(e) => setNewDoor({ ...newDoor, style: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddDoor}
                          size="sm"
                          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Door
                        </Button>
                        <Button
                          onClick={() => setShowAddDoor(false)}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="mt-3">
            <ProjectSummary 
              project={project} 
              jobs={jobs}
              onUpdateNotes={(value) => updateProjectMutation.mutate({ field: 'notes', value })}
            />
          </TabsContent>

          {(user?.role === 'admin' || user?.role === 'manager') && (
            <TabsContent value="financials" className="mt-3">
              <FinancialsTab 
                project={project}
                onUpdate={(fields) => {
                  updateProjectFieldsMutation.mutate(fields);
                }}
              />
            </TabsContent>
          )}

          <TabsContent value="quoting" className="mt-3">
            <QuotesSection 
              project={project}
              customer={customer}
              isAdmin={user?.role === 'admin'}
            />
          </TabsContent>

          <TabsContent value="parts" className="mt-3 space-y-6">
            <SamplesAtClientPanel project={project} />
            <ProjectPartsPanel 
              project={project} 
              parts={parts} 
              inventoryByItem={inventoryByItem} 
              onAddPart={() => window.triggerAddPart?.()}
            />
            <PartsSection 
              projectId={project.id} 
              autoExpand={project.status === "Parts Ordered"}
              registerAddPartTrigger={(fn) => { window.triggerAddPart = fn; }}
            />
            <LogisticsTimeline project={project} />
          </TabsContent>

          <TabsContent value="emails" className="mt-3">
            <ProjectEmailSection 
              project={project}
              onThreadLinked={() => {
                queryClient.invalidateQueries({ queryKey: ['project', project.id] });
              }}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-3">
            <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
              <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
                    Xero Invoices ({xeroInvoices.length})
                  </CardTitle>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        onClick={() => setShowLinkInvoiceModal(true)}
                        size="sm"
                        variant="outline"
                        className="font-semibold h-8 flex-1 sm:flex-initial"
                      >
                        <Link2 className="w-4 h-4 mr-1" />
                        Link Existing
                      </Button>
                      <Button
                        onClick={() => setShowInvoiceModal(true)}
                        size="sm"
                        className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-8 flex-1 sm:flex-initial"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Create Invoice
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {xeroInvoices.length === 0 ? (
                  <div className="text-center py-6 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                    <DollarSign className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
                    <p className="text-[14px] text-[#6B7280] mb-4">
                      No invoices created for this project yet.
                    </p>
                    {user?.role === 'admin' && (
                      <Button
                        onClick={() => setShowInvoiceModal(true)}
                        variant="outline"
                        size="sm"
                        className="border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Invoice
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {xeroInvoices.map((invoice) => (
                      <XeroInvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        onRefreshStatus={() => syncProjectInvoiceMutation.mutate(invoice.id)}
                        onViewInXero={() => window.open(invoice.pdf_url, '_blank')}
                        onTakePayment={() => {
                          setSelectedInvoice(invoice);
                          setShowPaymentModal(true);
                        }}
                        isRefreshing={syncProjectInvoiceMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(user?.role === 'admin' || user?.role === 'manager') && (
            <TabsContent value="warranty" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <WarrantyCard project={project} />
                <MaintenanceSection projectId={project.id} />
              </div>
            </TabsContent>
          )}
          </Tabs>
      </CardContent>

      <ProjectChangeHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        projectId={project.id}
      />
      </Card>
      </div>

      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
        canDelete={user?.role === 'admin'}
        onDelete={previewFile?.index !== undefined 
          ? () => handleImagesChange(project.image_urls.filter((_, i) => i !== previewFile.index))
          : previewFile?.name === 'Quote'
            ? () => updateProjectMutation.mutate({ field: 'quote_url', value: null })
            : previewFile?.name === 'Invoice'
              ? () => updateProjectMutation.mutate({ field: 'invoice_url', value: null })
              : null
        }
      />

      <CreateInvoiceModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onConfirm={(invoiceData) => createProjectInvoiceMutation.mutate(invoiceData)}
        isSubmitting={createProjectInvoiceMutation.isPending}
        type="project"
        data={{
          customer_name: project.customer_name,
          customer_email: project.customer_email,
          title: project.title,
          project_type: project.project_type
        }}
      />

      {selectedInvoice && (
        <TakePaymentModal
          open={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          paymentUrl={project.xero_payment_url}
        />
      )}

      <EntityModal
        open={!!previewJob}
        onClose={() => setPreviewJob(null)}
        title={`Job #${previewJob?.job_number}`}
        onOpenFullPage={() => {
          handleJobClick(previewJob.id);
          setPreviewJob(null);
        }}
        fullPageLabel="Open Full Job"
      >
        {previewJob && <JobModalView job={previewJob} />}
      </EntityModal>

      <MarkAsLostModal
        open={showLostModal}
        onClose={() => setShowLostModal(false)}
        onConfirm={handleMarkAsLost}
        openJobsCount={jobs.filter(j => j.status === "Open" || j.status === "Scheduled").length}
        isSubmitting={isMarkingLost}
      />

      <LinkInvoiceModal
        open={showLinkInvoiceModal}
        onClose={() => setShowLinkInvoiceModal(false)}
        onSelect={handleLinkExistingInvoice}
        isSubmitting={isLinkingInvoice}
      />

      {/* Old handover modal - replaced with new function
      <HandoverReportModal
        open={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        project={project}
        jobs={jobs}
      />
      */}

      <ProjectChatModal
        open={isChatOpen}
        onClose={() => handleChatOpenChange(false)}
        projectId={project.id}
      />

      {/* Activity Modal */}
      <EntityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Last Activity"
      >
        <LastActivityCard project={project} />
      </EntityModal>

      {/* All Contacts Modal */}
      <EntityModal
        open={showAllContactsModal}
        onClose={() => setShowAllContactsModal(false)}
        title={`All Project Contacts (${projectContacts.length})`}
      >
        <div className="p-4 space-y-4">
          {projectContacts.map((contact) => (
            <div key={contact.id} className="pb-4 border-b border-[#E5E7EB] last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-medium text-[15px] text-[#111827]">
                  {contact.name}
                </div>
                {contact.role && (
                  <Badge variant="outline" className="text-[11px] px-2 py-0.5">
                    {contact.role}
                  </Badge>
                )}
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2 text-[14px] text-[#6B7280] mb-1.5">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <a href={`tel:${contact.phone}`} className="hover:text-[#111827] transition-colors">
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 text-[14px] text-[#6B7280]">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:text-[#111827] transition-colors">
                    {contact.email}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </EntityModal>

      <MediaDocumentsDrawer 
        open={mediaDrawerOpen}
        onClose={() => setMediaDrawerOpen(false)}
        project={project}
        initialTab={mediaDrawerTab}
      />
    </div>
  );
}