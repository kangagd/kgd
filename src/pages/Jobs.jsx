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

  const { data: allJobs = [], isLoading, refetch } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date')
  });

  const jobs = allJobs.filter(job => !job.deleted_at);

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
      <div className="p-4 md:p-8 bg-gradient-to-br from-[hsl(32,20%,98%)] to-[hsl(32,25%,94%)] min-h-screen">
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
      <div className="bg-gradient-to-br from-[hsl(32,20%,98%)] to-[hsl(32,25%,94%)] min-h-screen">
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
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-[hsl(32,20%,98%)] to-[hsl(32,25%,94%)] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {!isTechnician && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[hsl(25,10%,12%)] tracking-tight">Jobs</h1>
              <p className="text-[hsl(25,8%,45%)] mt-2">Manage all scheduled jobs</p>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#fae008] text-[hsl(25,10%,12%)] hover:bg-[#e5d007] active:bg-[#d4c006] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Job
            </Button>
          </div>
        )}

        {isTechnician && (
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-[hsl(25,10%,12%)] tracking-tight">My Jobs</h1>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[hsl(25,8%,55%)]" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 border-2 border-[hsl(32,15%,88%)] focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 text-base rounded-xl"
              />
            </div>
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList className="h-12">
                <TabsTrigger value="list" className="gap-2 font-semibold">
                  <List className="w-4 h-4" />
                  <span className="hidden md:inline">List</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2 font-semibold">
                  <CalendarIcon className="w-4 h-4" />
                  <span className="hidden md:inline">Calendar</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {viewMode === "list" && (
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7 h-11">
                <TabsTrigger value="all" className="font-semibold">All</TabsTrigger>
                <TabsTrigger value="open" className="font-semibold">Open</TabsTrigger>
                <TabsTrigger value="scheduled" className="font-semibold">Scheduled</TabsTrigger>
                <TabsTrigger value="quoted" className="font-semibold">Quoted</TabsTrigger>
                <TabsTrigger value="invoiced" className="font-semibold">Invoiced</TabsTrigger>
                <TabsTrigger value="paid" className="font-semibold">Paid</TabsTrigger>
                <TabsTrigger value="completed" className="font-semibold">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {viewMode === "list" ? (
          <JobList
            jobs={filteredJobs}
            isLoading={isLoading}
            onSelectJob={setSelectedJob}
          />
        ) : (
          <CalendarView
            jobs={filteredJobs}
            onSelectJob={setSelectedJob}
            currentDate={calendarDate}
            onDateChange={setCalendarDate}
          />
        )}
      </div>
    </div>
  );
}