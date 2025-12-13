import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function EvidenceModal({ item, onClose }) {
  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evidence: {item.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!item.evidence || item.evidence.length === 0 ? (
            <p className="text-sm text-gray-500">No evidence recorded</p>
          ) : (
            item.evidence.map((ev, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{ev.source_type}</Badge>
                  {ev.source_id && (
                    <span className="text-xs text-gray-500">ID: {ev.source_id}</span>
                  )}
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {ev.excerpt}
                </div>
              </div>
            ))
          )}
          
          {item.score && (
            <div className="text-xs text-gray-500 pt-4 border-t">
              AI Confidence Score: {item.score}%
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}