import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EditableFileUpload from "../../jobs/EditableFileUpload";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Image as ImageIcon } from "lucide-react";

export default function SubmitWarrantyIssueModal({ isOpen, onClose, projectId, onSubmitted }) {
    const [description, setDescription] = useState("");
    const [photos, setPhotos] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!description) {
            toast.error("Please provide a description of the issue");
            return;
        }

        setIsSubmitting(true);
        try {
            const user = await base44.auth.me();
            await base44.entities.WarrantyIssue.create({
                project_id: projectId,
                reported_by: user.email,
                reported_at: new Date().toISOString(),
                description,
                photos,
                status: "New"
            });
            
            toast.success("Warranty issue reported successfully");
            onSubmitted?.();
            onClose();
            setDescription("");
            setPhotos([]);
        } catch (error) {
            console.error("Error submitting warranty issue:", error);
            toast.error("Failed to submit warranty issue");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Report Warranty Issue</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="description">Description of Issue</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the defect or issue..."
                            className="min-h-[100px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Photos / Evidence</Label>
                        <EditableFileUpload
                            files={photos}
                            onFilesChange={setPhotos}
                            accept="image/*"
                            multiple={true}
                            icon={ImageIcon}
                            label="Upload Photos"
                            emptyText="No photos uploaded"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
                        {isSubmitting ? "Submitting..." : "Submit Issue"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}