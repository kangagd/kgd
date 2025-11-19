import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, List, Calendar as CalendarIcon } from "lucide-react";
import JobForm from "../components/jobs/JobForm";
import JobList from "../components/jobs/JobList";
import JobDetails from "../components/jobs/JobDetails";
import CalendarView from "../components/jobs/CalendarView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Jobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState(null);
  const [preselectedProjectId, setPreselectedProjectId] = useState(null);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
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

  const statusFilters = [
  { value: "all", label: "All Jobs", color: "bg-slate-100 text-slate-700" },
  { value: "open", label: "Open", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "scheduled", label: "Scheduled", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { value: "completed", label: "Completed", color: "bg-green-50 text-green-700 border-green-200" }];


  const { data: allJobs = [], isLoading, refetch } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date')
  });

  const jobs = allJobs.filter((job) => !job.deleted_at);

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
      window.history.replaceState({}, '', window.location.pathname);
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
  }, [jobs]); // Add jobs as a dependency to useEffect

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

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingJob(null);
    setPreselectedCustomerId(null);
    setPreselectedProjectId(null);
    window.history.replaceState({}, '', window.location.pathname);
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

    return matchesSearch && matchesStatus;
  });

  if (showForm) {
    return (
      <div className="p-4 md:p-8 bg-[#F8F9FA] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <JobForm
            job={editingJob}
            technicians={technicians}
            onSubmit={handleSubmit}
            onCancel={handleCancelForm}
            isSubmitting={createJobMutation.isPending || updateJobMutation.isPending}
            preselectedCustomerId={preselectedCustomerId}
            preselectedProjectId={preselectedProjectId} />

        </div>
      </div>);

  }

  if (selectedJob) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen">
        <div className="mx-auto p-4 md:p-8 max-w-4xl">
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
            }} />

        </div>
      </div>);

  }

  return (
    <div className="bg-[#F8F9FA] p-2 md:p-8 min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        {!isTechnician &&
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-4">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-[#111827] tracking-tight">Jobs</h1>
              <p className="text-[#4B5563] mt-1 md:mt-2 text-sm md:text-base">Manage all scheduled jobs</p>
            </div>
            <Button
            onClick={() => setShowForm(true)}
            className="btn-primary w-full md:w-auto">
              <Plus className="w-5 h-5 mr-2" />
              New Job
            </Button>
          </div>
        }

        {isTechnician &&
        <div className="mb-4 md:mb-6">
            <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight">My Jobs</h1>
          </div>
        }

        <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="flex gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[#4B5563]" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-enhanced pl-9 md:pl-11 w-full" />

            </div>
            <Tabs value={viewMode} onValueChange={setViewMode} className="flex-shrink-0">
              <TabsList className="h-10 md:h-12">
                <TabsTrigger value="list" className="gap-1 md:gap-2 font-semibold text-xs md:text-sm px-2 md:px-3">
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1 md:gap-2 font-semibold text-xs md:text-sm px-2 md:px-3">
                  <CalendarIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {viewMode === "list" &&
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full overflow-x-hidden">
              <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto gap-1">
                {statusFilters.map((filter) =>
              <TabsTrigger key={filter.value} value={filter.value} className="font-semibold text-xs md:text-sm py-1.5 md:py-2 px-1 md:px-2 whitespace-nowrap">
                    {filter.label}
                  </TabsTrigger>
              )}
              </TabsList>
            </Tabs>
          }
        </div>

        {viewMode === "list" ?
        <JobList
          jobs={filteredJobs}
          isLoading={isLoading}
          onSelectJob={setSelectedJob} /> :


        <CalendarView
          jobs={filteredJobs}
          onSelectJob={setSelectedJob}
          currentDate={calendarDate}
          onDateChange={setCalendarDate} />

        }
      </div>
    </div>);

}