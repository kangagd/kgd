import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function PandaDocViewerModal({ open, onClose, url, quoteName }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[18px] font-semibold text-[#111827]">
              {quoteName || 'Quote Preview'}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(url, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <iframe
            src={url}
            className="w-full h-full border-0"
            title={quoteName || 'Quote Preview'}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}