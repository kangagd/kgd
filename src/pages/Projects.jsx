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

const statusColors = {
  open: "rgba(37, 99, 235, 0.15)",
  scheduled: "rgba(14, 165, 233, 0.15)",
  in_progress: "rgba(14, 165, 233, 0.15)",
  quoted: "rgba(124, 58, 237, 0.15)",
  invoiced: "rgba(249, 115, 22, 0.15)",
  paid: "rgba(22, 163, 74, 0.15)",
  completed: "rgba(21, 128, 61, 0.15)",
  cancelled: "rgba(220, 38, 38, 0.15)"
};

const statusTextColors = {
  open: "#2563EB",
  scheduled: "#0EA5E9",
  in_progress: "#0EA5E9",
  quoted: "#7C3AED",
  invoiced: "#F97316",
  paid: "#16A34A",
  completed: "#15803D",
  cancelled: "#DC2626"
};

const projectTypeColors = {
  "Garage Door Install": "bg-[#FEF8C8] text-slate-700",
  "Gate Install": "bg-green-100 text-green-700",
  "Roller Shutter Install": "bg-purple-100 text-purple-700",
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

  if (showForm) {
    return (
      <div className="p-4 md:p-8 bg-[#F8F9FA] min-h-screen">
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
      <div className="p-4 md:p-8 bg-[#F8F9FA] min-h-screen">
        <div className="mx-auto p-4 md:p-8 max-w-6xl">
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
    <div className="p-4 md:p-8 bg-[#F8F9FA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#111827] tracking-tight">Projects</h1>
            <p className="text-[#4B5563] mt-2">Manage multi-step workflows</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="btn-primary w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#4B5563]" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-enhanced pl-11 w-full"
            />
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-[#4B5563]">Loading projects...</p>
          </div>
        )}

        {!isLoading && filteredProjects.length === 0 && (
          <div className="text-center py-12 card-enhanced">
            <p className="text-[#4B5563] mb-4">No projects found</p>
            <Button onClick={() => setShowForm(true)} className="btn-primary">
              Create First Project
            </Button>
          </div>
        )}

        <div className="grid gap-4">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="card-enhanced card-interactive"
              onClick={() => setSelectedProject(project)}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[#111827] mb-2">{project.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {project.project_type && (
                        <Badge className={`${projectTypeColors[project.project_type]} font-semibold border-2 text-xs`}>
                          {project.project_type}
                        </Badge>
                      )}
                      <Badge 
                        className="capitalize font-semibold text-xs py-1 px-3 rounded-full"
                        style={{ 
                          backgroundColor: '#FAE008',
                          color: '#000000'
                        }}
                      >
                        {project.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-[#4B5563] mb-2 font-medium">{project.customer_name}</p>
                    {project.description && (
                      <div
                        className="text-sm text-[#4B5563] line-clamp-2 prose prose-sm max-w-none mb-2"
                        dangerouslySetInnerHTML={{ __html: project.description }}
                      />
                    )}
                    {project.doors && project.doors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {project.doors.map((door, idx) => (
                          <Badge key={idx} variant="outline" className="bg-white border-[#E5E7EB] text-[#4B5563] text-xs">
                            Door {idx + 1}: {door.height && door.width ? `${door.height} × ${door.width}` : 'Pending specs'}
                            {door.type && ` • ${door.type}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-[#4B5563] flex-shrink-0">
                    <div className="font-bold text-[#111827] text-lg">{getJobCount(project.id)}</div>
                    <div className="text-xs">jobs</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}