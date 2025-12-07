import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProjectChat from "./ProjectChat";

export default function ProjectChatModal({ open, onClose, projectId }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Project Chat</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ProjectChat projectId={projectId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}