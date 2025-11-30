import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, List, Calendar as CalendarIcon, ArrowUpDown, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import JobForm from "../components/jobs/JobForm";
import JobList from "../components/jobs/JobList";
import JobDetails from "../components/jobs/JobDetails";
import CalendarView from "../components/jobs/CalendarView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EntityModal from "../components/common/EntityModal.jsx";
import JobModalView from "../components/jobs/JobModalView";
import { createPageUrl } from "@/utils";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Jobs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("scheduled_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showForm, setShowForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState(null);
  const [preselectedProjectId, setPreselectedProjectId] = useState(null);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [modalJob, setModalJob] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
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

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['allJobs'],
    queryFn: async () => {
      try {
        console.log('[Jobs Debug] Fetching jobs...');
        // Use backend function to fetch jobs with robust permission handling
        const response = await base44.functions.invoke('getMyJobs');
        const allJobs = response.data || [];
        console.log('[Jobs Debug] ✅ Total jobs fetched:', allJobs.length);
        console.log('[Jobs Debug] All jobs:', allJobs);

        // Filter out deleted and cancelled jobs in the frontend
        const activeJobs = allJobs.filter(job => !job.deleted_at && job.status !== "Cancelled");
        console.log('[Jobs Debug] Active jobs (not deleted/cancelled):', activeJobs.length);

        return activeJobs;
      } catch (error) {
        console.error('[Jobs Debug] ❌ Error fetching jobs:', error);
        return [];
      }
    },
    refetchInterval: 5000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  const jobIdFromUrl = searchParams.get('jobId');

  const { data: directJob } = useQuery({
    queryKey: ['job', jobIdFromUrl],
    queryFn: () => base44.entities.Job.get(jobIdFromUrl),
    enabled: !!jobIdFromUrl,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: !!(user?.role === 'admin' || user?.role === 'manager')
  });

  const createJobMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('manageJob', { action: 'create', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      refetch();
      setShowForm(false);
      setEditingJob(null);
      setPreselectedCustomerId(null);
      setPreselectedProjectId(null);
      setSearchParams({}); 
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke('manageJob', { action: 'update', id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      refetch();
      setShowForm(false);
      setEditingJob(null);
      setSelectedJob(null);
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId) => {
      const result = await base44.functions.invoke('manageJob', { action: 'delete', id: jobId });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      refetch();
      setSelectedJob(null);
    },
    onError: (error) => {
      console.error("Error deleting job:", error);
      alert(`Failed to delete job: ${error.message || 'Unknown error'}`);
    }
  });

  useEffect(() => {
    const action = searchParams.get('action');
    const customerId = searchParams.get('customerId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');

    if (action === 'new' || action === 'create' || customerId || projectId) {
      setShowForm(true);
      if (customerId) setPreselectedCustomerId(customerId);
      if (projectId) setPreselectedProjectId(projectId);
    }

    if (status) {
      setStatusFilter(status);
    }

    if (dateFromParam) setDateFrom(dateFromParam);
    if (dateToParam) setDateTo(dateToParam);
  }, [searchParams]);

  useEffect(() => {
    if (jobIdFromUrl && directJob) {
      setSelectedJob(directJob);
    } else if (!jobIdFromUrl && selectedJob) {
      setSelectedJob(null);
    }
  }, [jobIdFromUrl, directJob]);

  const handleSubmit = (data) => {
    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, data });
    } else {
      createJobMutation.mutate(data);
    }
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    setShowForm(true);
    setSelectedJob(null);
  };

  const handleDelete = (jobId) => {
    deleteJobMutation.mutate(jobId);
  };

  const handleOpenFullJob = (job) => {
    setModalJob(null);
    window.location.href = `${createPageUrl("Jobs")}?jobId=${job.id}`;
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isTechnician = user?.is_field_technician && !isAdminOrManager;
  const isViewer = user?.role === 'viewer';
  const canCreateJobs = isAdminOrManager;

  const filteredJobs = jobs.filter((job) => {
    // Technician filtering: only filter if user is explicitly a technician
    // Relaxed filtering to ensure jobs are visible. Assignment check should happen but if data is mismatching, 
    // we rely on the backend sending relevant jobs. 
    // Since backend now sends ALL jobs for technicians (to fix visibility), we temporarily disable strict frontend filtering.
    /*
    if (isTechnician && user) {
      const userEmail = user.email?.toLowerCase().trim();
      const isAssignedToTechnician = Array.isArray(job.assigned_to) 
        ? job.assigned_to.some(email => email?.toLowerCase().trim() === userEmail)
        : (typeof job.assigned_to === 'string' && job.assigned_to.toLowerCase().trim() === userEmail);

      if (!isAssignedToTechnician) {
        return false;
      }
    }
    */

    // Remove URL date filter - let users see all jobs regardless of URL params
    
    const matchesSearch = !searchTerm || 
      job.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_number?.toString().includes(searchTerm);

    const matchesStatus = statusFilter === "all" ? true : 
                          statusFilter === "Logistics" ? (job.job_category === 'Logistics' || (job.job_type_name || "").includes("Logistics") || (job.job_type || "").includes("Logistics")) :
                          job.status === statusFilter;

    const matchesTechnician = technicianFilter === "all" || 
      (Array.isArray(job.assigned_to) 
        ? job.assigned_to.includes(technicianFilter)
        : job.assigned_to === technicianFilter);

    const matchesDateRange = (!dateFrom || !job.scheduled_date || job.scheduled_date >= dateFrom) &&
                             (!dateTo || !job.scheduled_date || job.scheduled_date <= dateTo);

    return matchesSearch && matchesStatus && matchesTechnician && matchesDateRange;
  }).sort((a, b) => {
    let compareA, compareB;
    
    switch(sortBy) {
      case 'scheduled_date':
        compareA = a.scheduled_date || '';
        compareB = b.scheduled_date || '';
        break;
      case 'customer_name':
        compareA = a.customer_name?.toLowerCase() || '';
        compareB = b.customer_name?.toLowerCase() || '';
        break;
      case 'job_number':
        compareA = a.job_number || 0;
        compareB = b.job_number || 0;
        break;
      case 'status':
        compareA = a.status || '';
        compareB = b.status || '';
        break;
      default:
        return 0;
    }

    if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
    if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Debug logging
  useEffect(() => {
    console.log('[Jobs Debug] Raw jobs count:', jobs.length);
    console.log('[Jobs Debug] Raw jobs:', jobs);
    console.log('[Jobs Debug] Filters applied:');
    console.log('  - Status filter:', statusFilter);
    console.log('  - Technician filter:', technicianFilter);
    console.log('  - Date from:', dateFrom);
    console.log('  - Date to:', dateTo);
    console.log('  - Search term:', searchTerm);
    console.log('  - Is technician:', isTechnician);
    console.log('  - User:', user);
    console.log('[Jobs Debug] Jobs after filtering:', filteredJobs.length);
    console.log('[Jobs Debug] Filtered jobs:', filteredJobs);
    console.log('[Jobs Debug] showForm:', showForm);
    console.log('[Jobs Debug] selectedJob:', selectedJob);
    console.log('[Jobs Debug] viewMode:', viewMode);
  }, [jobs, filteredJobs, statusFilter, technicianFilter, dateFrom, dateTo, searchTerm, isTechnician, user, showForm, selectedJob, viewMode]);

  if (showForm) {
    return (
      <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <JobForm
            job={editingJob}
            technicians={technicians}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingJob(null);
              setPreselectedCustomerId(null);
              setPreselectedProjectId(null);
              setSearchParams({});
            }}
            isSubmitting={createJobMutation.isPending || updateJobMutation.isPending}
            preselectedCustomerId={preselectedCustomerId}
            preselectedProjectId={preselectedProjectId}
          />
        </div>
      </div>
    );
    }

  if (selectedJob) {
    return (
      <div className="bg-[#ffffff] min-h-screen">
        <div className="mx-auto p-5 md:p-10 max-w-4xl">
          <JobDetails
            job={selectedJob}
            onClose={() => {
              setSelectedJob(null);
              navigate(createPageUrl("Jobs"));
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={(newStatus) => {
              updateJobMutation.mutate({
                id: selectedJob.id,
                data: { status: newStatus }
              });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        {!isTechnician && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#111827] leading-tight">Jobs</h1>
              <p className="text-sm text-[#4B5563] mt-1">{isViewer ? 'View all scheduled jobs' : 'Manage all scheduled jobs'}</p>
            </div>
            {canCreateJobs && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Job
              </Button>
            )}
          </div>
        )}

        {isTechnician && (
          <div className="py-3 lg:py-4 mb-4 lg:mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-[#111827] leading-tight">My Jobs</h1>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full"
              />
              <button 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B7280] hover:text-[#111827] transition-colors"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {viewMode === "list" && (
            <div className="flex items-center gap-3">
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                  <TabsTrigger value="Logistics" className="flex-1">Logistics</TabsTrigger>
                  <TabsTrigger value="Open" className="flex-1">Open</TabsTrigger>
                  <TabsTrigger value="Scheduled" className="flex-1">Scheduled</TabsTrigger>
                  <TabsTrigger value="Completed" className="flex-1">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex-shrink-0 h-10 px-3 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            </div>
          )}

          {showFilters && viewMode === "list" && (
            <div className="flex flex-wrap gap-3">
              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger className="w-full md:w-[200px] h-10">
                  <SelectValue placeholder="All Technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.email} value={tech.email}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto h-10 gap-2">
                    <Filter className="w-4 h-4" />
                    Date Range
                    {(dateFrom || dateTo) && (
                      <span className="ml-1 px-1.5 py-0.5 bg-[#FAE008] text-[#111827] rounded text-xs font-semibold">
                        {dateFrom && dateTo ? '2' : '1'}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">From Date</label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">To Date</label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    {(dateFrom || dateTo) && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                        }}
                        className="w-full"
                      >
                        Clear Dates
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [field, order] = value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}>
                <SelectTrigger className="w-full md:w-[220px] h-10">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled_date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="scheduled_date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="customer_name-asc">Customer (A-Z)</SelectItem>
                  <SelectItem value="customer_name-desc">Customer (Z-A)</SelectItem>
                  <SelectItem value="job_number-desc">Job # (High-Low)</SelectItem>
                  <SelectItem value="job_number-asc">Job # (Low-High)</SelectItem>
                  <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {viewMode === "list" ? (
          <JobList
            jobs={filteredJobs}
            isLoading={isLoading}
            onSelectJob={(job) => setSelectedJob(job)}
            onViewDetails={(job) => setModalJob(job)}
          />
        ) : (
          <CalendarView
            jobs={filteredJobs}
            onSelectJob={(job) => setModalJob(job)}
            currentDate={calendarDate}
            onDateChange={setCalendarDate}
          />
        )}

        <EntityModal
          open={!!modalJob}
          onClose={() => setModalJob(null)}
          title={`Job #${modalJob?.job_number}`}
          onOpenFullPage={() => handleOpenFullJob(modalJob)}
          fullPageLabel="Open Full Job"
        >
          {modalJob && <JobModalView job={modalJob} />}
        </EntityModal>
      </div>
    </div>
  );
}