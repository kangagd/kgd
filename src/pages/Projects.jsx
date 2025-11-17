import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Search, Plus, User, Calendar, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import ProjectForm from "../components/projects/ProjectForm";
import ProjectDetails from "../components/projects/ProjectDetails";

const projectTypeColors = {
  "Installation": "bg-blue-100 text-blue-700 border-blue-200",
  "Repair": "bg-orange-100 text-orange-700 border-orange-200",
  "Maintenance": "bg-green-100 text-green-700 border-green-200",
  "Quote": "bg-purple-100 text-purple-700 border-purple-200",
  "Service": "bg-amber-100 text-amber-700 border-amber-200",
};

const statusColors = {
  "in_progress": "bg-blue-100 text-blue-800 border-blue-200",
  "awaiting_parts": "bg-amber-100 text-amber-800 border-amber-200",
  "scheduled": "bg-purple-100 text-purple-800 border-purple-200",
  "completed": "bg-green-100 text-green-800 border-green-200",
  "cancelled": "bg-slate-100 text-slate-800 border-slate-200",
  "on_hold": "bg-red-100 text-red-800 border-red-200",
};

const stageColors = {
  "measure": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "quote": "bg-purple-100 text-purple-700 border-purple-200",
  "approval": "bg-amber-100 text-amber-700 border-amber-200",
  "install": "bg-blue-100 text-blue-700 border-blue-200",
  "complete": "bg-green-100 text-green-700 border-green-200",
};

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.filter({ deleted_at: { $exists: false } }, '-created_date')
  });

  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.filter({ deleted_at: { $exists: false } })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      refetch();
      setShowForm(false);
      setEditingProject(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Project.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      refetch();
      setShowForm(false);
      setEditingProject(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      refetch();
      setSelectedProject(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setSelectedProject(null);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const filteredProjects = projects.filter(project =>
    project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getVisitCount = (projectId) => {
    return allJobs.filter(j => j.project_id === projectId).length;
  };

  if (showForm) {
    return (
      <ProjectForm
        project={editingProject}
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingProject(null);
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    );
  }

  if (selectedProject) {
    return (
      <ProjectDetails
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onEdit={() => handleEdit(selectedProject)}
        onDelete={() => handleDelete(selectedProject.id)}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#fae008] rounded-xl flex items-center justify-center shadow-md">
            <FolderKanban className="w-6 h-6 text-[#000000]" />
          </div>
          <h1 className="text-3xl font-bold text-[#000000] tracking-tight">Projects</h1>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Project
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse rounded-2xl">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl border-2 border-slate-200">
          <FolderKanban className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-[#000000] mb-2">No projects found</h3>
          <p className="text-slate-600 mb-4">
            {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first project'}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-lg transition-all cursor-pointer border-2 border-slate-200 rounded-2xl group"
              onClick={() => setSelectedProject(project)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="text-xl font-bold text-[#000000] group-hover:text-blue-600 transition-colors tracking-tight">
                        {project.name}
                      </h3>
                      {project.project_type && (
                        <Badge className={`${projectTypeColors[project.project_type]} font-semibold border-2`}>
                          {project.project_type}
                        </Badge>
                      )}
                      {project.status && (
                        <Badge className={`${statusColors[project.status]} font-semibold border-2`}>
                          {project.status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {project.stage && (
                        <Badge className={`${stageColors[project.stage]} font-semibold border-2`}>
                          Stage: {project.stage}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      {project.customer_name && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold">{project.customer_name}</span>
                        </div>
                      )}
                      {project.address && (
                        <div className="flex items-start gap-2 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span>{project.address}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 pt-2">
                        {project.start_date && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>Started: {format(parseISO(project.start_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-600">
                          <Badge variant="outline" className="bg-slate-50">
                            {getVisitCount(project.id)} visit{getVisitCount(project.id) !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                      {project.description && (
                        <p className="text-slate-600 mt-2 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}