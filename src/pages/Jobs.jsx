import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, List, Calendar as CalendarIcon, ArrowUpDown, Filter } from "lucide-react";
import { AddIconButton } from "@/components/ui/AddIconButton";
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
import { buildActiveCheckInMap } from "@/components/domain/checkInHelpers";
import BackButton from "../components/common/BackButton";
import { notifySuccess, notifyError } from "@/components/utils/notify";
import { jobKeys } from "@/components/api/queryKeys";
import { QUERY_CONFIG } from "@/components/api/queryConfig";

export default function Jobs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [jobScope, setJobScope] = useState("all"); // "all" or "mine"
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
  const [activeCheckInMap, setActiveCheckInMap] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        // Default to "mine" for technicians
        if (currentUser?.is_field_technician && currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
          setJobScope("mine");
        }
      } catch (error) {
        // Error loading user
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadActiveCheckIns() {
      try {
        // Fetch all active check-ins (no check_out_time)
        const res = await base44.entities.CheckInOut.filter({
          check_out_time: null,
        });

        if (isCancelled) return;

        const records = Array.isArray(res) ? res : res?.data || [];
        const map = buildActiveCheckInMap(records);
        setActiveCheckInMap(map);
      } catch (error) {
        if (!isCancelled) {
          setActiveCheckInMap({});
        }
      }
    }

    loadActiveCheckIns();

    // Refresh every minute
    const interval = setInterval(loadActiveCheckIns, 60 * 1000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  const [allJobsData, setAllJobsData] = useState([]);
  const [jobsCursor, setJobsCursor] = useState(null);
  const [hasMoreJobs, setHasMoreJobs] = useState(true);

  const { data: jobsPage, isLoading, refetch, isFetching } = useQuery({
    queryKey: [...jobKeys.allJobs(), jobsCursor],
    queryFn: async () => {
      try {
        if (!jobsCursor) {
          const response = await base44.functions.invoke('getMyJobs');
          const allJobs = response.data || [];
          const activeJobs = allJobs.filter(job => !job.deleted_at && job.status !== "Cancelled");
          
          activeJobs.sort((a, b) => {
            const dateA = a.updated_date || a.created_date || '';
            const dateB = b.updated_date || b.created_date || '';
            return dateB.localeCompare(dateA);
          });
          
          const limited = activeJobs.slice(0, 50);
          return {
            data: limited,
            nextCursor: activeJobs.length > 50 ? 'page-2' : null
          };
        } else {
          const response = await base44.functions.invoke('getMyJobs');
          const allJobs = response.data || [];
          const activeJobs = allJobs.filter(job => !job.deleted_at && job.status !== "Cancelled");
          
          activeJobs.sort((a, b) => {
            const dateA = a.updated_date || a.created_date || '';
            const dateB = b.updated_date || b.created_date || '';
            return dateB.localeCompare(dateA);
          });
          
          const pageNum = parseInt(jobsCursor.split('-')[1]) || 2;
          const offset = (pageNum - 1) * 50;
          const limited = activeJobs.slice(offset, offset + 50);
          
          return {
            data: limited,
            nextCursor: activeJobs.length > offset + 50 ? `page-${pageNum + 1}` : null
          };
        }
      } catch (error) {
        return { data: [], nextCursor: null };
      }
    },
    ...QUERY_CONFIG.reference,
  });

  // Accumulate jobs data
  useEffect(() => {
    if (jobsPage) {
      if (!jobsCursor) {
        // First page - replace all
        setAllJobsData(jobsPage.data || []);
      } else {
        // Subsequent pages - append
        setAllJobsData(prev => [...prev, ...(jobsPage.data || [])]);
      }
      setHasMoreJobs(!!jobsPage.nextCursor);
    }
  }, [jobsPage, jobsCursor]);

  const jobs = allJobsData;

  const handleLoadMore = () => {
    if (jobsPage?.nextCursor && !isFetching) {
      setJobsCursor(jobsPage.nextCursor);
    }
  };

  const jobIdFromUrl = searchParams.get('jobId');

  const { data: directJob } = useQuery({
    queryKey: jobKeys.detail(jobIdFromUrl),
    queryFn: () => base44.entities.Job.get(jobIdFromUrl),
    enabled: !!jobIdFromUrl,
    ...QUERY_CONFIG.reference,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: !!(user?.role === 'admin' || user?.role === 'manager'),
    ...QUERY_CONFIG.reference,
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.filter({ is_active: true }),
    ...QUERY_CONFIG.reference,
  });

  const createJobMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('manageJob', { action: 'create', data });
      
      // Sync address from project if job is linked to a project
      if (response.data?.project_id) {
        try {
          await base44.functions.invoke('syncJobAddressesFromProject', {
            project_id: response.data.project_id
          });
        } catch (err) {
          console.error('Failed to sync address from project:', err);
        }
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
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
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      refetch();
      setShowForm(false);
      setEditingJob(null);
      setSelectedJob(null);
      notifySuccess('Job updated successfully');
    },
    onError: (error) => {
      notifyError('Failed to update job', error);
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId) => {
      const result = await base44.functions.invoke('manageJob', { action: 'delete', id: jobId });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setJobsCursor(null); // Reset pagination
      setAllJobsData([]); // Clear accumulated data
      refetch();
      setSelectedJob(null);
      setModalJob(null);
      navigate(createPageUrl("Jobs")); // Navigate back to list
      notifySuccess('Job deleted successfully');
    },
    onError: (error) => {
      notifyError('Failed to delete job', error);
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

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isTechnician = user?.is_field_technician && !isAdminOrManager;
  const isViewer = user?.role === 'viewer';
  const canCreateJobs = isAdminOrManager;

  // Memoized job filtering and sorting to avoid re-computation on every render
  const filteredJobs = React.useMemo(() => jobs.filter((job) => {
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
    
    const matchesSearch = !debouncedSearchTerm || 
      job.customer_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      job.job_number?.toString().includes(debouncedSearchTerm);

    const matchesStatus = statusFilter === "all" || job.status === statusFilter;

    // Scope filtering
    const matchesScope = jobScope === "all" || (
      user?.email && (
        Array.isArray(job.assigned_to) 
          ? job.assigned_to.includes(user.email) 
          : job.assigned_to === user.email
      )
    );

    const matchesTechnician = technicianFilter === "all" || 
      (Array.isArray(job.assigned_to) 
        ? job.assigned_to.includes(technicianFilter)
        : job.assigned_to === technicianFilter);

    const matchesJobType = jobTypeFilter === "all" || 
      job.job_type_id === jobTypeFilter ||
      job.job_type === jobTypeFilter ||
      job.job_type_name === jobTypeFilter;

    const matchesDateRange = (!dateFrom || !job.scheduled_date || job.scheduled_date >= dateFrom) &&
                             (!dateTo || !job.scheduled_date || job.scheduled_date <= dateTo);

    return matchesSearch && matchesStatus && matchesTechnician && matchesJobType && matchesDateRange && matchesScope;
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
  }), [jobs, debouncedSearchTerm, statusFilter, jobScope, user?.email, technicianFilter, jobTypeFilter, dateFrom, dateTo, sortBy, sortOrder]);

  const handleSubmit = useCallback((data) => {
    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, data });
    } else {
      createJobMutation.mutate(data);
    }
  }, [editingJob, updateJobMutation, createJobMutation]);

  const handleEdit = useCallback((job) => {
    setEditingJob(job);
    setShowForm(true);
    setSelectedJob(null);
  }, []);

  const handleDelete = useCallback((jobId) => {
    deleteJobMutation.mutate(jobId);
  }, [deleteJobMutation]);

  const handleOpenFullJob = useCallback((job) => {
    setModalJob(null);
    window.location.href = `${createPageUrl("Jobs")}?jobId=${job.id}`;
  }, []);

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
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111827] leading-tight">
              {isTechnician ? "My Jobs" : "Jobs"}
            </h1>
            <p className="text-sm text-[#4B5563] mt-1">
              {isTechnician 
                ? "These are the jobs currently assigned to you."
                : (isViewer ? 'View all scheduled jobs' : 'Manage all scheduled jobs')
              }
            </p>
          </div>
          {canCreateJobs && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#6B7280]">New Job</span>
              <AddIconButton
                onClick={() => setShowForm(true)}
                title="Create New Job"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col gap-3">
            {isTechnician && (
              <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setJobScope("mine")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    jobScope === "mine" 
                      ? "bg-white text-[#111827] shadow-sm" 
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  My Jobs
                </button>
                <button
                  onClick={() => setJobScope("all")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    jobScope === "all" 
                      ? "bg-white text-[#111827] shadow-sm" 
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  All Jobs
                </button>
              </div>
            )}
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
          </div>

          {viewMode === "list" && (
            <div className="flex items-center gap-3">
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
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
            <div className="max-w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              <div className="flex gap-3 min-w-max">
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

              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger className="w-full md:w-[200px] h-10">
                  <SelectValue placeholder="All Job Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Job Types</SelectItem>
                  {jobTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
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
            </div>
          )}
        </div>

        {viewMode === "list" ? (
          <JobList
            jobs={filteredJobs}
            isLoading={isLoading}
            onSelectJob={(job) => setSelectedJob(job)}
            onViewDetails={(job) => setModalJob(job)}
            activeCheckInMap={activeCheckInMap}
          />
        ) : (
          <CalendarView
            jobs={filteredJobs}
            onSelectJob={(job) => setModalJob(job)}
            currentDate={calendarDate}
            onDateChange={setCalendarDate}
          />
        )}

        {hasMoreJobs && !isLoading && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={handleLoadMore}
              disabled={isFetching}
              variant="outline"
              className="min-w-[200px]"
            >
              {isFetching ? "Loading..." : "Load More"}
            </Button>
          </div>
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