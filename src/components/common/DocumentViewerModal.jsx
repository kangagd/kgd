import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText } from "lucide-react";

export default function DocumentViewerModal({ open, onClose, url, title = "Document", onDelete }) {
  const isMobile = window.innerWidth < 768;

  // On desktop, just open in new tab and close modal
  React.useEffect(() => {
    if (open && !isMobile && url) {
      window.open(url, '_blank');
      onClose();
    }
  }, [open, isMobile, url, onClose]);

  // If desktop, don't render modal (it auto-opens in new tab)
  if (!isMobile) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full max-h-[95vh] h-[95vh] w-[95vw] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-[#E5E7EB]">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-[#FAE008]" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <iframe
            src={url}
            className="w-full h-full"
            title={title}
          />
        </div>

        <DialogFooter className="px-4 py-3 border-t border-[#E5E7EB] flex-row justify-between gap-2">
          {onDelete && (
            <Button
              onClick={() => {
                onDelete();
                onClose();
              }}
              variant="destructive"
              className="flex-1"
            >
              Delete
            </Button>
          )}
          <Button
            onClick={() => window.open(url, '_blank')}
            variant="outline"
            className="flex-1"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}