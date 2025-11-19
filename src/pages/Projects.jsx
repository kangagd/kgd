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

const projectTypeColors = {
  "Garage Door Install": "bg-blue-50 text-blue-700 border-blue-200",
  "Gate Install": "bg-green-50 text-green-700 border-green-200",
  "Roller Shutter Install": "bg-purple-50 text-purple-700 border-purple-200",
  "Repair": "bg-orange-50 text-orange-700 border-orange-200",
  "Maintenance": "bg-indigo-50 text-indigo-700 border-indigo-200"
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
    const projectId = params.get('projectId');
    
    if (action === 'new') {
      setShowForm(true);
    }
    
    if (projectId) {
      const project = projects.find(p => p.id === projectId);
      if (project) setSelectedProject(project);
    }
  }, [projects]);

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
            <h1 className="text-2xl md:text-3xl font-bold text-[#111827] tracking-tight">Projects</h1>
            <p className="text-[#4B5563] mt-2 text-sm md:text-base">Manage multi-step workflows</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="btn-primary w-full md:w-auto h-12"
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
              className="input-enhanced pl-11 w-full h-12"
            />
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse card-enhanced">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredProjects.length === 0 && (
          <div className="text-center py-12 card-enhanced">
            <p className="text-[#4B5563] mb-4 text-sm md:text-base">No projects found</p>
            <Button onClick={() => setShowForm(true)} className="btn-primary h-12">
              Create First Project
            </Button>
          </div>
        )}

        {!isLoading && filteredProjects.length > 0 && (
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="card-enhanced card-interactive"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-lg md:text-xl font-bold text-[#111827]">{project.title}</h3>
                        <Badge className={`status-${project.status} capitalize text-xs`}>
                          {project.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <p className="text-sm md:text-base text-[#4B5563] font-medium">{project.customer_name}</p>
                        {project.project_type && (
                          <Badge className={`${projectTypeColors[project.project_type]} font-semibold border-2 text-xs rounded-lg px-2 py-1`}>
                            {project.project_type}
                          </Badge>
                        )}
                      </div>
                      {project.description && (
                        <div
                          className="text-sm text-[#4B5563] line-clamp-2 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: project.description }}
                        />
                      )}
                      {project.doors && project.doors.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.doors.map((door, idx) => (
                            <Badge key={idx} className="bg-[#F8F9FA] border-2 border-[#E5E7EB] text-[#111827] text-xs font-medium px-2 py-1">
                              Door {idx + 1}: {door.height && door.width ? `${door.height} × ${door.width}` : 'Pending'}
                              {door.type && ` • ${door.type}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center bg-[#F8F9FA] rounded-lg px-4 py-3 min-w-[70px]">
                      <div className="text-2xl font-bold text-[#111827]">{getJobCount(project.id)}</div>
                      <div className="text-xs text-[#4B5563] font-medium uppercase tracking-wide">Jobs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}