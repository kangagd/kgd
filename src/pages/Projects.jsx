import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, SlidersHorizontal, User, Filter, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import EntityModal from "../components/common/EntityModal.jsx";
import ProjectModalView from "../components/projects/ProjectModalView";
import { createPageUrl } from "@/utils";

const statusColors = {
  "Lead": "bg-slate-100 text-slate-800 border-slate-200",
  "Initial Site Visit": "bg-blue-100 text-blue-800 border-blue-200",
  "Quote Sent": "bg-purple-100 text-purple-800 border-purple-200",
  "Quote Approved": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Final Measure": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Parts Ordered": "bg-amber-100 text-amber-800 border-amber-200",
  "Scheduled": "bg-[#fae008]/20 text-[hsl(25,10%,12%)] border-[#fae008]/30",
  "Completed": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Warranty": "bg-red-100 text-red-800 border-red-200"
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
  const [modalProject, setModalProject] = useState(null);
  const queryClient = useQueryClient();

  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const projects = allProjects.filter(p => !p.deleted_at);

  const { data: allJobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.filter({ deleted_at: { $exists: false } })
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
    const projectId = params.get('projectId');
    
    if (action === 'new') {
      setShowForm(true);
    }
    
    if (projectId && projects.length > 0 && !selectedProject) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setSelectedProject(project);
      }
    }
  }, [projects, selectedProject]);

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

  const handleOpenFullProject = (project) => {
    setModalProject(null);
    window.location.href = `${createPageUrl("Projects")}?projectId=${project.id}`;
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
        const stages = ["Lead", "Initial Site Visit", "Quote Sent", "Quote Approved", "Final Measure", "Parts Ordered", "Scheduled", "Completed", "Warranty"];
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
      <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
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
      <div className="bg-[#ffffff] min-h-screen">
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
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Projects</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage all projects and quotes</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search projects..."
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

          <div className="chip-container -mx-4 px-4 md:mx-0 md:px-0">
            <Tabs value={stageFilter} onValueChange={setStageFilter} className="w-full">
              <TabsList className="inline-flex w-auto min-w-full justify-start">
                <TabsTrigger value="all" className="whitespace-nowrap flex-shrink-0">All Projects</TabsTrigger>
                {Object.keys(statusColors).map((stage) => (
                  <TabsTrigger key={stage} value={stage} className="whitespace-nowrap flex-shrink-0">
                    {stage}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {showFilters && (
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-full md:w-[200px] h-10">
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
                      <SelectItem value="Warranty">Warranty</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={partsStatusFilter} onValueChange={setPartsStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px] h-10">
                      <SelectValue placeholder="Parts Status" />
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

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-[200px] h-10">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_date">Order Date (Newest)</SelectItem>
                      <SelectItem value="stage">Project Stage</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Start Date"
                    className="w-full md:w-[160px] h-10"
                  />

                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="End Date"
                    className="w-full md:w-[160px] h-10"
                  />

                  {(stageFilter !== "all" || partsStatusFilter !== "all" || startDate || endDate || sortBy !== "created_date") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStageFilter("all");
                        setPartsStatusFilter("all");
                        setStartDate("");
                        setEndDate("");
                        setSortBy("created_date");
                      }}
                      className="h-10"
                    >
                      Clear Filters
                    </Button>
                  )}
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
                className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative"
                onClick={() => setSelectedProject(project)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-lg hover:bg-[#F3F4F6] z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalProject(project);
                  }}
                >
                  <Eye className="w-4 h-4 text-[#6B7280]" />
                </Button>
                <CardContent className="p-4">
                  {/* Top row */}
                  <div className="mb-3">
                    <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2] mb-2 pr-8">{project.title}</h3>
                    <div className="flex items-center gap-2">
                      {project.project_type && (
                        <Badge className={`${projectTypeColors[project.project_type]} font-medium border-0 px-3 py-1 text-[12px] leading-[1.35] hover:opacity-100`}>
                         {project.project_type}
                        </Badge>
                      )}
                      <Badge className={`${statusColors[project.status]} font-medium border-0 px-3 py-1 text-[12px] leading-[1.35] hover:opacity-100`}>
                        {project.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Second row */}
                  <div className="flex items-center gap-4 mb-3 text-[#4B5563]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span className="text-[14px] leading-[1.4]">{project.customer_name}</span>
                    </div>
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
                  {project.stage && (
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="outline" className="font-medium text-[12px] leading-[1.35] border-[#E5E7EB]">
                        {project.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
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

        <EntityModal
          open={!!modalProject}
          onClose={() => setModalProject(null)}
          title={modalProject?.title || "Project"}
          onOpenFullPage={() => handleOpenFullProject(modalProject)}
          fullPageLabel="Open Full Project"
        >
          {modalProject && (
            <ProjectModalView 
              project={modalProject} 
              jobCount={getJobCount(modalProject.id)}
            />
          )}
        </EntityModal>
      </div>
    </div>
  );
}