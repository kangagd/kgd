import React from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";

export default function EntityModal({ 
  open, 
  onClose, 
  title, 
  children, 
  onOpenFullPage,
  fullPageLabel = "Open Full Page"
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {onOpenFullPage && (
              <Button
                onClick={onOpenFullPage}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">{fullPageLabel}</span>
              </Button>
            )}
            <Button
              onClick={() => onClose(false)}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="px-6 py-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}