import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Sparkles } from "lucide-react";
import RichTextField from "../common/RichTextField";
import AddressAutocomplete from "../common/AddressAutocomplete";
import { PROJECT_TYPE_OPTIONS } from "@/components/domain/projectConfig";
import { toast } from "sonner";

/**
 * DraftProjectForm - Project creation with AI-filled field highlighting
 * 
 * Rules:
 * - Nothing persisted until user confirms
 * - AI-filled fields visually highlighted
 * - source_email_thread_id stored on save
 * - Fields: title, description, project_type, address
 */
export default function DraftProjectForm({ 
  thread, 
  onConfirm, 
  onCancel, 
  isSubmitting = false 
}) {
  const [formData, setFormData] = useState({
    title: thread?.subject || "",
    description: thread?.ai_overview || "",
    project_type: "Garage Door Install",
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    address_country: "Australia",
    google_place_id: "",
    latitude: null,
    longitude: null,
    source_email_thread_id: thread?.id || ""
  });

  // Track which fields were pre-filled by AI
  const aiFilledFields = useMemo(() => ({
    title: !!thread?.subject,
    description: !!thread?.ai_overview,
    project_type: false // Never pre-filled, user must choose
  }), [thread]);

  const handleAddressChange = (addressData) => {
    setFormData(prev => ({
      ...prev,
      ...addressData,
      address_full: addressData.address_full || prev.address_full
    }));
  };

  const handleSubmit = () => {
    if (!formData.title?.trim()) {
      toast.error("Project title is required");
      return;
    }
    if (!formData.project_type) {
      toast.error("Project type is required");
      return;
    }
    
    onConfirm(formData);
  };

  return (
    <div className="space-y-4">
      {/* Draft mode indicator */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 text-sm">Draft Mode</h3>
          <p className="text-xs text-amber-800 mt-1">Project won't be created until you confirm. AI-filled fields shown below.</p>
        </div>
      </div>

      <Card className="border-2 border-slate-200">
        <CardContent className="p-6 space-y-6">
          {/* Title - AI filled */}
          <div className="space-y-2">
            <Label htmlFor="draft-title" className="flex items-center gap-2">
              Project Title *
              {aiFilledFields.title && (
                <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  AI filled
                </span>
              )}
            </Label>
            <Input
              id="draft-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Garage Door Repair - Unit 6"
              className={`border-2 ${aiFilledFields.title ? 'border-yellow-300 bg-yellow-50' : 'border-slate-300'} focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20`}
            />
          </div>

          {/* Project Type - User must choose */}
          <div className="space-y-2">
            <Label htmlFor="draft-type">Project Type *</Label>
            <Select value={formData.project_type} onValueChange={(val) => setFormData({ ...formData, project_type: val })}>
              <SelectTrigger className="border-2 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description - AI filled */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Description
              {aiFilledFields.description && (
                <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  AI summary
                </span>
              )}
            </Label>
            <RichTextField
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder="Project description and scope..."
              className={aiFilledFields.description ? 'border-yellow-300 bg-yellow-50' : ''}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="draft-address">Project Address</Label>
            <AddressAutocomplete
              id="draft-address"
              value={formData.address_full || ""}
              onChange={handleAddressChange}
              className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
            />
          </div>

          {/* Hidden field for linking */}
          <input type="hidden" value={formData.source_email_thread_id} />
        </CardContent>

        <CardFooter className="border-t-2 border-slate-200 flex justify-end gap-3 p-6 bg-slate-50">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="border-2 hover:bg-white font-semibold"
          >
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting} 
            className="bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-bold shadow-md hover:shadow-lg transition-all"
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}