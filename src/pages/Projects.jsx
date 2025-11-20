import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ProjectForm from "../components/projects/ProjectForm";
import ProjectDetails from "../components/projects/ProjectDetails";
import ProjectStageSelector from "../components/projects/ProjectStageSelector";

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

  const handleStageChange = async (projectId, currentStage, newStage) => {
    const user = await base44.auth.me();
    await base44.entities.ChangeHistory.create({
      project_id: projectId,
      field_name: 'status',
      old_value: String(currentStage),
      new_value: String(newStage),
      changed_by: user.email,
      changed_by_name: user.full_name
    });
    updateProjectMutation.mutate({ id: projectId, data: { status: newStage } });
  };

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

  const filteredProjects = projects.filter((project) => {
    return (
      project.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
            <h1 className="text-3xl font-bold text-[#111827] tracking-tight">Projects</h1>
            <p className="text-[#4B5563] mt-2.5">Manage multi-step workflows</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto h-12 rounded-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
        </div>

        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-base rounded-lg"
            />
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-[hsl(25,8%,45%)]">Loading projects...</p>
          </div>
        )}

        {!isLoading && filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-[hsl(32,15%,88%)]">
            <p className="text-[hsl(25,8%,45%)] mb-4">No projects found</p>
            <Button onClick={() => setShowForm(true)} className="bg-[#fae008] text-[hsl(25,10%,12%)] font-semibold">
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
                    <h3 className="text-xl font-bold text-[#111827] flex-1">{project.title}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {project.project_type && (
                        <Badge className={`${projectTypeColors[project.project_type]} font-semibold border-0 px-3 py-1`}>
                          {project.project_type}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stage selector */}
                  <div className="mb-3">
                    <ProjectStageSelector
                      currentStage={project.status}
                      onStageChange={(newStage) => handleStageChange(project.id, project.status, newStage)}
                      size="compact"
                    />
                  </div>

                  {/* Second row */}
                  <div className="flex items-center gap-4 mb-3 text-[#4B5563]">
                    <span className="font-medium">{project.customer_name}</span>
                    {suburb && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm">{suburb}</span>
                      </div>
                    )}
                  </div>

                  {/* Third row */}
                  {(scopeSummary || project.stage) && (
                    <div className="flex items-center gap-3 mb-3">
                      {scopeSummary && (
                        <span className="text-sm text-[#111827] font-medium">{scopeSummary}</span>
                      )}
                      {project.stage && (
                        <Badge variant="outline" className="font-semibold text-xs border-[#E5E7EB]">
                          {project.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Bottom row */}
                  <div className="flex items-center justify-between text-sm pt-3 border-t border-[#E5E7EB]">
                    <span className="text-[#4B5563] font-medium">
                      Jobs: <span className="text-[#111827] font-bold">{jobCount}</span>
                    </span>
                    {nextJob && (
                      <div className="text-[#4B5563]">
                        <span className="font-medium">Next: </span>
                        <span className="text-[#111827]">
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