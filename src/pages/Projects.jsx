import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import ProjectForm from "../components/projects/ProjectForm";
import ProjectDetails from "../components/projects/ProjectDetails";

const statusColors = {
  "Lead": "bg-slate-100 text-slate-800 border-slate-200",
  "Initial Site Visit": "bg-blue-100 text-blue-800 border-blue-200",
  "Quote Sent": "bg-purple-100 text-purple-800 border-purple-200",
  "Quote Approved": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Final Measure": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Parts Ordered": "bg-amber-100 text-amber-800 border-amber-200",
  "Scheduled": "bg-[#fae008]/20 text-[hsl(25,10%,12%)] border-[#fae008]/30",
  "Completed": "bg-emerald-100 text-emerald-800 border-emerald-200"
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

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [partsStatusFilter, setPartsStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("created_date");
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const queryClient = useQueryClient();

  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date')
  });

  const projects = allProjects.filter(p => !p.deleted_at);

  const { data: allJobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const { data: allParts = [] } = useQuery({
    queryKey: ['allParts'],
    queryFn: () => base44.entities.Part.list()
  });

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      setEditingProject(null);
    }
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Project.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      setEditingProject(null);
      setSelectedProject(null);
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId) => {
      await base44.entities.Project.update(projectId, { deleted_at: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProject(null);
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'new') {
      setShowForm(true);
    }
  }, []);

  const handleSubmit = (data) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
    setSelectedProject(null);
  };

  const handleDelete = (projectId) => {
    deleteProjectMutation.mutate(projectId);
  };

  const filteredProjects = projects
    .filter((project) => {
      const matchesSearch = 
        project.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStage = stageFilter === "all" || project.status === stageFilter;
      
      const projectParts = allParts.filter(p => p.project_id === project.id);
      const matchesPartsStatus = partsStatusFilter === "all" || 
        projectParts.some(p => p.status === partsStatusFilter);
      
      let matchesDateRange = true;
      if (startDate || endDate) {
        const projectDate = new Date(project.created_date);
        if (startDate && new Date(startDate) > projectDate) matchesDateRange = false;
        if (endDate && new Date(endDate) < projectDate) matchesDateRange = false;
      }
      
      return matchesSearch && matchesStage && matchesPartsStatus && matchesDateRange;
    })
    .sort((a, b) => {
      if (sortBy === "created_date") {
        return new Date(b.created_date) - new Date(a.created_date);
      } else if (sortBy === "stage") {
        const stages = ["Lead", "Initial Site Visit", "Quote Sent", "Quote Approved", "Final Measure", "Parts Ordered", "Scheduled", "Completed"];
        return stages.indexOf(a.status) - stages.indexOf(b.status);
      }
      return 0;
    });

  const getJobCount = (projectId) => {
    return allJobs.filter(j => j.project_id === projectId && !j.deleted_at).length;
  };

  const getNextJob = (projectId) => {
    const projectJobs = allJobs.filter(j => j.project_id === projectId && !j.deleted_at && j.scheduled_date);
    const futureJobs = projectJobs.filter(j => new Date(j.scheduled_date) >= new Date());
    if (futureJobs.length === 0) return null;
    return futureJobs.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0];
  };

  const extractSuburb = (address) => {
    if (!address) return null;
    const parts = address.split(',').map(p => p.trim());
    return parts.length > 1 ? parts[parts.length - 2] : null;
  };

  const buildScopeSummary = (project) => {
    if (!project.doors || project.doors.length === 0) return null;
    const doorCount = project.doors.length;
    const firstDoor = project.doors[0];
    const doorType = firstDoor.type || 'doors';
    const dimensions = firstDoor.height && firstDoor.width ? `${firstDoor.height} x ${firstDoor.width}` : '';
    return `${doorCount}x ${doorType}${dimensions ? ` • ${dimensions}` : ''}`;
  };

  if (showForm) {
    return (
      <div className="p-5 md:p-10 bg-[#F8F9FA] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <ProjectForm
            project={editingProject}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingProject(null);
            }}
            isSubmitting={createProjectMutation.isPending || updateProjectMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (selectedProject) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen">
        <div className="mx-auto p-5 md:p-10 max-w-6xl">
          <ProjectDetails
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-10 bg-[#F8F9FA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-5">
          <div>
            <h1 className="text-[28px] font-bold text-[#111827] leading-[1.2]">Projects</h1>
            <p className="text-[14px] text-[#4B5563] leading-[1.4] mt-2.5">Manage multi-step workflows</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto h-12 rounded-lg text-[14px] leading-[1.4]"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-[14px] leading-[1.4] rounded-lg"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="h-12 px-4 border-2 border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
            >
              <SlidersHorizontal className="w-5 h-5 mr-2" />
              Filters
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <Badge
              onClick={() => setStageFilter("all")}
              className={`cursor-pointer px-4 py-2 text-[13px] font-medium transition-all whitespace-nowrap ${
                stageFilter === "all"
                  ? "bg-[#FAE008] text-[#111827] border-2 border-[#FAE008] hover:bg-[#E5CF07]"
                  : "bg-white text-[#4B5563] border-2 border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
              }`}
            >
              All Projects
            </Badge>
            {Object.keys(statusColors).map((stage) => (
              <Badge
                key={stage}
                onClick={() => setStageFilter(stage)}
                className={`cursor-pointer px-4 py-2 text-[13px] font-medium transition-all whitespace-nowrap ${
                  stageFilter === stage
                    ? `${statusColors[stage]} border-2 hover:opacity-90`
                    : "bg-white text-[#4B5563] border-2 border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
                }`}
              >
                {stage}
              </Badge>
            ))}
          </div>

          {showFilters && (
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Project Stage</Label>
                    <Select value={stageFilter} onValueChange={setStageFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Stages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        <SelectItem value="Lead">Lead</SelectItem>
                        <SelectItem value="Initial Site Visit">Initial Site Visit</SelectItem>
                        <SelectItem value="Quote Sent">Quote Sent</SelectItem>
                        <SelectItem value="Quote Approved">Quote Approved</SelectItem>
                        <SelectItem value="Final Measure">Final Measure</SelectItem>
                        <SelectItem value="Parts Ordered">Parts Ordered</SelectItem>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Parts Status</Label>
                    <Select value={partsStatusFilter} onValueChange={setPartsStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Ordered">Ordered</SelectItem>
                        <SelectItem value="Back-ordered">Back-ordered</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_date">Order Date (Newest)</SelectItem>
                        <SelectItem value="stage">Project Stage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStageFilter("all");
                        setPartsStatusFilter("all");
                        setStartDate("");
                        setEndDate("");
                        setSortBy("created_date");
                      }}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-[hsl(25,8%,45%)]">Loading projects...</p>
          </div>
        )}

        {!isLoading && filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-[hsl(32,15%,88%)]">
            <p className="text-[14px] text-[#4B5563] leading-[1.4] mb-4">No projects found</p>
            <Button onClick={() => setShowForm(true)} className="bg-[#fae008] text-[#111827] font-semibold text-[14px] leading-[1.4]">
              Create First Project
            </Button>
          </div>
        )}

        <div className="grid gap-4">
          {filteredProjects.map((project) => {
            const jobCount = getJobCount(project.id);
            const nextJob = getNextJob(project.id);
            const suburb = extractSuburb(project.address);
            const scopeSummary = buildScopeSummary(project);

            return (
              <Card
                key={project.id}
                className="border-2 border-[#FAE008] bg-white hover:bg-[#FFFEF5] hover:shadow-lg transition-all cursor-pointer rounded-xl overflow-hidden"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2] flex-1">{project.title}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {project.project_type && (
                        <Badge className={`${projectTypeColors[project.project_type]} font-medium border-0 px-3 py-1 text-[12px] leading-[1.35]`}>
                          {project.project_type}
                        </Badge>
                      )}
                      <Badge className={`${statusColors[project.status]} font-medium border-0 px-3 py-1 text-[12px] leading-[1.35]`}>
                        {project.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Second row */}
                  <div className="flex items-center gap-4 mb-3 text-[#4B5563]">
                    <span className="text-[16px] font-medium leading-[1.4]">{project.customer_name}</span>
                    {suburb && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[14px] leading-[1.4]">{suburb}</span>
                      </div>
                    )}
                  </div>

                  {/* Third row */}
                  {(scopeSummary || project.stage) && (
                    <div className="flex items-center gap-3 mb-3">
                      {scopeSummary && (
                        <span className="text-[14px] text-[#111827] font-medium leading-[1.4]">{scopeSummary}</span>
                      )}
                      {project.stage && (
                        <Badge variant="outline" className="font-medium text-[12px] leading-[1.35] border-[#E5E7EB]">
                          {project.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Bottom row */}
                  <div className="flex items-center justify-between text-[14px] leading-[1.4] pt-3 border-t border-[#E5E7EB]">
                    <span className="text-[#4B5563] font-medium">
                      Jobs: <span className="text-[#111827] font-semibold">{jobCount}</span>
                    </span>
                    {nextJob && (
                      <div className="text-[#4B5563]">
                        <span className="font-medium">Next: </span>
                        <span className="text-[#111827] font-medium">
                          {new Date(nextJob.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          {nextJob.scheduled_time && ` · ${nextJob.scheduled_time}`}
                          {nextJob.job_type_name && ` · ${nextJob.job_type_name}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}