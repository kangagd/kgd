import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TextField from "../common/TextField";
import RichTextField from "../common/RichTextField";

export default function QuotingSection({ project }) {
  const [quoteValue, setQuoteValue] = useState(project.quote_value || "");
  const [quoteProducts, setQuoteProducts] = useState(project.quote_products || "");
  const [quoteNotes, setQuoteNotes] = useState(project.quote_notes || "");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const updateProjectMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Project.update(project.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['allProjects'] });
    }
  });

  useEffect(() => {
    setQuoteValue(project.quote_value || "");
    setQuoteProducts(project.quote_products || "");
    setQuoteNotes(project.quote_notes || "");
  }, [project]);

  const handleQuoteValueBlur = () => {
    if (quoteValue !== project.quote_value) {
      updateProjectMutation.mutate({ field: 'quote_value', value: parseFloat(quoteValue) || 0 });
    }
  };

  const handleQuoteProductsBlur = () => {
    if (quoteProducts !== project.quote_products) {
      updateProjectMutation.mutate({ field: 'quote_products', value: quoteProducts });
    }
  };

  const handleQuoteNotesBlur = () => {
    if (quoteNotes !== project.quote_notes) {
      updateProjectMutation.mutate({ field: 'quote_notes', value: quoteNotes });
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(result => result.file_url);
      
      const currentAttachments = project.quote_attachments || [];
      updateProjectMutation.mutate({ 
        field: 'quote_attachments', 
        value: [...currentAttachments, ...newUrls] 
      });
    } catch (error) {
      console.error("Error uploading files:", error);
    }
    setUploading(false);
  };

  const removeAttachment = (indexToRemove) => {
    const updatedAttachments = (project.quote_attachments || []).filter((_, index) => index !== indexToRemove);
    updateProjectMutation.mutate({ field: 'quote_attachments', value: updatedAttachments });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="quote_value">Quote Value</Label>
        <div className="relative mt-1.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-[14px]">$</span>
          <Input
            id="quote_value"
            type="number"
            step="0.01"
            value={quoteValue}
            onChange={(e) => setQuoteValue(e.target.value)}
            onBlur={handleQuoteValueBlur}
            placeholder="0.00"
            className="pl-7"
          />
        </div>
      </div>

      <div>
        <RichTextField
          label="Quote Products"
          value={quoteProducts}
          onChange={setQuoteProducts}
          onBlur={handleQuoteProductsBlur}
          placeholder="List the doors, products, and items included in this quote..."
        />
      </div>

      <div>
        <RichTextField
          label="Quote Notes"
          value={quoteNotes}
          onChange={setQuoteNotes}
          onBlur={handleQuoteNotesBlur}
          placeholder="Add exclusions, special conditions, terms, or other quote context..."
          helperText="Internal notes and special conditions"
        />
      </div>

      <div>
        <Label>Quote Attachments</Label>
        <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden mt-1.5">
          <CardContent className="p-3 space-y-3">
            {project.quote_attachments && project.quote_attachments.length > 0 && (
              <div className="space-y-2">
                {project.quote_attachments.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-[#F8F9FA] rounded-lg border border-[#E5E7EB]">
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-[14px] text-[#111827] hover:underline truncate"
                    >
                      Quote Document {index + 1}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-600 hover:bg-red-50 rounded p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Quote Documents'}
                </span>
              </Button>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}