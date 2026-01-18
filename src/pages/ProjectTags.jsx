import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Plus, Pencil, ToggleLeft, ToggleRight, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

export default function ProjectTags() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [disableConfirm, setDisableConfirm] = useState(null);
  const queryClient = useQueryClient();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['projectTags'],
    queryFn: () => base44.entities.ProjectTagDefinition.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-tag-check'],
    queryFn: () => base44.entities.Project.list(),
    enabled: !!disableConfirm,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const normalized_name = data.name.toLowerCase().trim();
      
      return base44.entities.ProjectTagDefinition.create({
        ...data,
        slug,
        normalized_name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTags'] });
      setIsCreateOpen(false);
      toast.success('Tag created successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create tag');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const normalized_name = data.name.toLowerCase().trim();
      return base44.entities.ProjectTagDefinition.update(id, { ...data, normalized_name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTags'] });
      setEditingTag(null);
      toast.success('Tag updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update tag');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => 
      base44.entities.ProjectTagDefinition.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTags'] });
      setDisableConfirm(null);
      toast.success('Tag status updated');
    },
  });

  const handleDisable = (tag) => {
    const usageCount = projects.filter(p => 
      p.project_tag_ids?.includes(tag.id)
    ).length;
    setDisableConfirm({ tag, usageCount });
  };

  const confirmDisable = () => {
    if (disableConfirm) {
      toggleActiveMutation.mutate({
        id: disableConfirm.tag.id,
        is_active: false,
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#111827]">Project Tags</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Manage tags for categorizing and filtering projects
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]">
          <Plus className="w-4 h-4 mr-2" />
          New Tag
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-[#E5E7EB]">
          <Tag className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-[14px] text-[#6B7280]">No tags created yet</p>
          <Button 
            onClick={() => setIsCreateOpen(true)} 
            variant="outline" 
            className="mt-4"
          >
            Create your first tag
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {tags.map(tag => (
            <div
              key={tag.id}
              className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center justify-between hover:border-[#D1D5DB] transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <Badge 
                  style={{ backgroundColor: tag.color }}
                  className="text-white font-semibold min-w-[100px] justify-center"
                >
                  {tag.name}
                </Badge>
                {tag.description && (
                  <span className="text-[13px] text-[#6B7280]">{tag.description}</span>
                )}
                <span className="text-[12px] text-[#9CA3AF] font-mono">
                  {tag.slug}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!tag.is_active && (
                  <Badge variant="outline" className="text-[11px] text-red-600 border-red-200">
                    Disabled
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTag(tag)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (tag.is_active) {
                      handleDisable(tag);
                    } else {
                      toggleActiveMutation.mutate({ id: tag.id, is_active: true });
                    }
                  }}
                  title={tag.is_active ? "Disable tag" : "Enable tag"}
                >
                  {tag.is_active ? (
                    <ToggleRight className="w-5 h-5 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-[#9CA3AF]" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <TagFormDialog
        open={isCreateOpen || !!editingTag}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingTag(null);
        }}
        tag={editingTag}
        onSubmit={(data) => {
          if (editingTag) {
            updateMutation.mutate({ id: editingTag.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Disable Confirmation */}
      <AlertDialog open={!!disableConfirm} onOpenChange={() => setDisableConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              {disableConfirm?.usageCount > 0 ? (
                <>
                  This tag is currently used by <strong>{disableConfirm.usageCount}</strong> project(s).
                  Disabling it will prevent new assignments, but existing projects will keep the tag.
                </>
              ) : (
                'This tag is not currently in use. You can safely disable it.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisable}>
              Disable Tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TagFormDialog({ open, onClose, tag, onSubmit, isSubmitting }) {
  const [name, setName] = useState(tag?.name || '');
  const [color, setColor] = useState(tag?.color || '#6B7280');
  const [description, setDescription] = useState(tag?.description || '');

  React.useEffect(() => {
    if (tag) {
      setName(tag.name || '');
      setColor(tag.color || '#6B7280');
      setDescription(tag.description || '');
    } else if (!open) {
      setName('');
      setColor('#6B7280');
      setDescription('');
    }
  }, [tag, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    onSubmit({ name: name.trim(), color, description: description.trim() });
  };

  const presetColors = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', 
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#64748B', '#6B7280', '#111827'
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Tag Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warranty, Urgent, Builder"
              autoFocus
            />
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <div className="flex flex-wrap gap-2">
                {presetColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded border-2 transition-all ${
                      color === c ? 'border-[#111827] scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of tag purpose"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Badge 
              style={{ backgroundColor: color }}
              className="text-white font-semibold"
            >
              {name || 'Preview'}
            </Badge>
            <span className="text-[12px] text-[#9CA3AF]">
              Preview
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : tag ? 'Update Tag' : 'Create Tag'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}