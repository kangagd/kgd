import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader } from "lucide-react";

export default function CreateProjectFromThreadModal({
  open,
  onClose,
  thread,
  onCreated,
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    customer_email: "",
    description: "",
  });

  // Initialize form from thread data
  useEffect(() => {
    if (open && thread) {
      // Clean subject as title
      const title = (thread.subject || "").replace(/^(Re:|Fwd:)/i, "").trim();
      
      // Extract email from last external sender
      const senderEmail = thread.from_address || "";
      
      // Use thread snippet as description start
      const description = thread.last_message_snippet || "";

      setFormData({
        title: title || "New Project from Email",
        customer_email: senderEmail,
        description,
      });
    }
  }, [open, thread]);

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error("Project title is required");
      return;
    }

    setLoading(true);
    try {
      // Create project
      const project = await base44.entities.Project.create({
        title: formData.title,
        description: formData.description,
        status: "Lead",
        project_type: "Other",
      });

      // Link thread to project
      if (thread && project.id) {
        await base44.entities.EmailThread.update(thread.id, {
          project_id: project.id,
          project_number: project.project_number || null,
          project_title: project.title || null,
          linked_to_project_at: new Date().toISOString(),
          linked_to_project_by: (await base44.auth.me()).email,
          // DEFENSIVE: Clear contract links
          contract_id: null,
          contract_name: null,
          contract_status: null,
          contract_type: null,
        });
      }

      toast.success(`Project "${formData.title}" created and linked`);
      onCreated?.();
      onClose();
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Project from Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Project Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter project title..."
            />
          </div>

          <div>
            <Label htmlFor="email">Customer Email</Label>
            <Input
              id="email"
              value={formData.customer_email}
              onChange={(e) =>
                setFormData({ ...formData, customer_email: e.target.value })
              }
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <Label htmlFor="description">Description / Notes</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Project description or notes..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}