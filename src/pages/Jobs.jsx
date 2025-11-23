import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function Jobs() {
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
    queryFn: () => base44.entities.Job.filter({ deleted_at: { $exists: false } }, '-scheduled_date'),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const createJobMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      refetch();
      setShowForm(false);
      setEditingJob(null);
      setPreselectedCustomerId(null);
      setPreselectedProjectId(null);
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
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
      const result = await base44.entities.Job.update(jobId, { deleted_at: new Date().toISOString() });
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
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const jobId = params.get('jobId');
    const customerId = params.get('customerId');
    const projectId = params.get('projectId');
    const status = params.get('status');

    if (action === 'new' || customerId || projectId) {
      setShowForm(true);
      if (customerId) setPreselectedCustomerId(customerId);
      if (projectId) setPreselectedProjectId(projectId);
    }

    if (jobId) {
      const job = jobs.find((j) => j.id === jobId);
      if (job) setSelectedJob(job);
    }

    if (status) {
      setStatusFilter(status);
    }
  }, [jobs]);

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

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const filteredJobs = jobs.filter((job) => {
    if (isTechnician && job.assigned_to !== user?.email) {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    const dateFilter = params.get('date');
    if (dateFilter && job.scheduled_date !== dateFilter) {
      return false;
    }

    const matchesSearch =
    job.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.job_number?.toString().includes(searchTerm);

    const matchesStatus = statusFilter === "all" || job.status === statusFilter;

    const matchesTechnician = technicianFilter === "all" || 
      (Array.isArray(job.assigned_to) 
        ? job.assigned_to.includes(technicianFilter)
        : job.assigned_to === technicianFilter);

    const matchesDateRange = (!dateFrom || job.scheduled_date >= dateFrom) &&
                             (!dateTo || job.scheduled_date <= dateTo);

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

  if (showForm) {
    return (
      <div className="p-5 md:p-10 bg-[#F8F9FA] min-h-screen">
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
      <div className="bg-[#F8F9FA] min-h-screen">
        <div className="mx-auto p-5 md:p-10 max-w-4xl">
          <JobDetails
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
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
    <div className="p-4 md:p-5 lg:p-10 bg-[#F8F9FA] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        {!isTechnician && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#111827] leading-tight">Jobs</h1>
              <p className="text-sm text-[#4B5563] mt-1">Manage all scheduled jobs</p>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          </div>
        )}

        {isTechnician && (
          <div className="py-3 lg:py-4 mb-4 lg:mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-[#111827] leading-tight">My Jobs</h1>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-base rounded-lg w-full"
              />
            </div>
            <Tabs value={viewMode} onValueChange={setViewMode} className="flex-shrink-0">
              <TabsList>
                <TabsTrigger value="list" className="gap-2">
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {viewMode === "list" && (
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="chip-container -mx-4 px-4 md:mx-0 md:px-0">
                <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                  <TabsList className="w-full justify-start min-w-max md:min-w-0">
                    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                    <TabsTrigger value="Open" className="flex-1">Open</TabsTrigger>
                    <TabsTrigger value="Scheduled" className="flex-1">Scheduled</TabsTrigger>
                    <TabsTrigger value="Completed" className="flex-1">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex flex-wrap gap-3">
                <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                  <SelectTrigger className="w-full md:w-[200px] h-11">
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
                    <Button variant="outline" className="w-full md:w-auto h-11 gap-2">
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
                  <SelectTrigger className="w-full md:w-[220px] h-11">
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
            onSelectJob={(job) => setModalJob(job)}
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