import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import FilePreviewModal from "../../common/FilePreviewModal";

export default function ReviewWarrantyIssueModal({ isOpen, onClose, issue, onResolved }) {
    const [resolutionNotes, setResolutionNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);

    if (!issue) return null;

    const handleApprove = async () => {
        setIsProcessing(true);
        try {
            // Invoke backend function to create job
            const res = await base44.functions.invoke('warranty_createJob', { issueId: issue.id });
            if (res.data.error) throw new Error(res.data.error);
            
            // Update issue with notes if any (though backend updates status to Approved)
            if (resolutionNotes) {
                await base44.entities.WarrantyIssue.update(issue.id, { resolution_notes: resolutionNotes });
            }

            toast.success("Warranty approved and job created");
            onResolved?.();
            onClose();
        } catch (error) {
            console.error("Error approving warranty:", error);
            toast.error("Failed to approve warranty: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!resolutionNotes) {
            toast.error("Please provide a reason for rejection");
            return;
        }

        setIsProcessing(true);
        try {
            await base44.entities.WarrantyIssue.update(issue.id, {
                status: "Rejected",
                resolution_notes: resolutionNotes,
                resolved_at: new Date().toISOString()
            });
            toast.success("Warranty issue rejected");
            onResolved?.();
            onClose();
        } catch (error) {
            console.error("Error rejecting warranty:", error);
            toast.error("Failed to reject warranty");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Review Warranty Issue</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500 block">Reported By</span>
                            <span className="font-medium">{issue.reported_by}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Date</span>
                            <span className="font-medium">{new Date(issue.reported_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-lg border">
                        <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Description</span>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{issue.description}</p>
                    </div>

                    {issue.photos && issue.photos.length > 0 && (
                        <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase block mb-2">Evidence</span>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {issue.photos.map((url, idx) => (
                                    <img 
                                        key={idx}
                                        src={url}
                                        alt="Evidence"
                                        className="h-20 w-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => setPreviewFile({ url, type: 'image', name: `Evidence ${idx+1}` })}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="resolution">Resolution / Rejection Notes</Label>
                        <Textarea
                            id="resolution"
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            placeholder="Enter notes for approval or reason for rejection..."
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button 
                            variant="destructive" 
                            onClick={handleReject} 
                            disabled={isProcessing}
                            className="flex-1 sm:flex-none"
                        >
                            Reject
                        </Button>
                        <Button 
                            onClick={handleApprove} 
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                        >
                            Approve & Create Job
                        </Button>
                    </div>
                </DialogFooter>

                <FilePreviewModal
                    isOpen={!!previewFile}
                    onClose={() => setPreviewFile(null)}
                    file={previewFile}
                />
            </DialogContent>
        </Dialog>
    );
}