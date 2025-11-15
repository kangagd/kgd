import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import JobForm from "../components/jobs/JobForm";
import JobList from "../components/jobs/JobList";
import JobDetails from "../components/jobs/JobDetails";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Jobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState(null);
  const [user, setUser] = useState(null);
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

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.filter({ is_active: true }),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
  });

  const createJobMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setShowForm(false);
      setEditingJob(null);
      setPreselectedCustomerId(null);
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setShowForm(false);
      setEditingJob(null);
      setSelectedJob(null);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const jobId = params.get('id');
    const customerId = params.get('customer_id');
    const status = params.get('status');
    const date = params.get('date');
    
    if (action === 'new') {
      setShowForm(true);
      if (customerId) {
        setPreselectedCustomerId(customerId);
      }
    }
    
    if (jobId) {
      const job = jobs.find(j => j.id === jobId);
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

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';
  
  const filteredJobs = jobs.filter(job => {
    // For technicians, only show their assigned jobs
    if (isTechnician && job.assigned_to !== user?.email) {
      return false;
    }

    // Apply URL date filter if present
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
      <div className="p-2 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <JobForm
            job={editingJob}
            jobTypes={jobTypes}
            technicians={technicians}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingJob(null);
              setPreselectedCustomerId(null);
            }}
            isSubmitting={createJobMutation.isPending || updateJobMutation.isPending}
            preselectedCustomerId={preselectedCustomerId}
          />
        </div>
      </div>
    );
  }

  if (selectedJob) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className={isTechnician ? "" : "p-2 md:p-8 max-w-4xl mx-auto"}>
          <JobDetails
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onEdit={handleEdit}
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
    <div className="p-2 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {!isTechnician && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Jobs</h1>
              <p className="text-slate-500 mt-1 text-sm">Manage all scheduled jobs</p>
            </div>
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-orange-600 hover:bg-orange-700 w-full md:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          </div>
        )}

        {isTechnician && (
          <div className="mb-3 md:mb-4">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">My Jobs</h1>
          </div>
        )}

        <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="w-full grid grid-cols-2 sm:grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <JobList 
          jobs={filteredJobs}
          isLoading={isLoading}
          onSelectJob={setSelectedJob}
        />
      </div>
    </div>
  );
}