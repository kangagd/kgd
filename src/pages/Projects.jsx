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
  open: "bg-[hsl(32,25%,94%)] text-[hsl(25,10%,12%)] border-[hsl(32,15%,88%)]",
  scheduled: "bg-[#fae008]/20 text-[hsl(25,10%,12%)] border-[#fae008]/30",
  quoted: "bg-purple-100 text-purple-800 border-purple-200",
  invoiced: "bg-indigo-100 text-indigo-800 border-indigo-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-[hsl(32,25%,94%)] text-[hsl(25,10%,12%)] border-[hsl(32,15%,88%)]"
};

const projectTypeColors = {
  "Garage Door Install": "bg-blue-100 text-blue-700",
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
      <div className="p-4 md:p-8 bg-gradient-to-br from-[hsl(32,20%,98%)] to-[hsl(32,25%,94%)] min-h-screen">
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
      <div className="bg-gradient-to-br from-[hsl(32,20%,98%)] to-[hsl(32,25%,94%)] min-h-screen">
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
    <div className="p-4 md:p-8 bg-gradient-to-br from-[hsl(32,20%,98%)] to-[hsl(32,25%,94%)] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[hsl(25,10%,12%)] tracking-tight">Projects</h1>
            <p className="text-[hsl(25,8%,45%)] mt-2">Manage multi-step workflows</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#fae008] text-[hsl(25,10%,12%)] hover:bg-[#e5d007] active:bg-[#d4c006] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[hsl(25,8%,55%)]" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 border-2 border-[hsl(32,15%,88%)] focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 text-base rounded-xl"
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
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="border-2 border-[hsl(32,15%,88%)] hover:border-[#fae008] hover:shadow-lg transition-all cursor-pointer rounded-2xl"
              onClick={() => setSelectedProject(project)}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-lg font-bold text-[hsl(25,10%,12%)]">{project.title}</h3>
                      {project.project_type && (
                        <Badge className={`${projectTypeColors[project.project_type]} font-semibold border-2`}>
                          {project.project_type}
                        </Badge>
                      )}
                      <Badge className={`${statusColors[project.status]} font-semibold border-2`}>
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-[hsl(25,8%,45%)] mb-2">{project.customer_name}</p>
                    {project.description && (
                      <div
                        className="text-sm text-[hsl(25,8%,45%)] line-clamp-2 prose prose-sm max-w-none mb-2"
                        dangerouslySetInnerHTML={{ __html: project.description }}
                      />
                    )}
                    {project.doors && project.doors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {project.doors.map((door, idx) => (
                          <Badge key={idx} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                            Door {idx + 1}: {door.height && door.width ? `${door.height} × ${door.width}` : 'Pending specs'}
                            {door.type && ` • ${door.type}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-[hsl(25,8%,45%)]">
                    <div className="font-bold text-[hsl(25,10%,12%)]">{getJobCount(project.id)} jobs</div>
                    {project.created_date && (
                      <div className="text-xs">Created {new Date(project.created_date).toLocaleDateString()}</div>
                    )}
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