import React, { useState, useRef } from "react";
import { X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function MediaDocumentsDrawer({ open, onClose, project, initialTab = "photos", onUploadPhotos, onUploadDocuments }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);

  React.useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const handleUploadClick = () => {
    if (activeTab === "photos") {
      photoInputRef.current?.click();
    } else {
      docInputRef.current?.click();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
          <h2 className="text-[18px] font-semibold text-[#111827]">Media & Documents</h2>
          <div className="flex items-center gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onUploadPhotos?.(e)}
            />
            <input
              ref={docInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onUploadDocuments?.(e)}
            />
            <Button
              size="sm"
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              onClick={(e) => {
                e.stopPropagation();
                handleUploadClick();
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-4 py-3 border-b border-[#E5E7EB]">
              <TabsList className="w-full">
                <TabsTrigger value="photos" className="flex-1">Photos</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="photos" className="p-4">
              {!project.image_urls || project.image_urls.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <p className="text-[14px]">No photos yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {project.image_urls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#E5E7EB] hover:border-[#FAE008] transition-colors cursor-pointer group">
                      <img 
                        src={url} 
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="p-4">
              {(!project.other_documents || project.other_documents.length === 0) && 
               !project.quote_url && 
               !project.invoice_url && 
               !project.handover_pdf_url ? (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <p className="text-[14px]">No documents yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {project.quote_url && (
                    <a 
                      href={project.quote_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all"
                    >
                      <div className="text-[14px] font-medium text-[#111827]">Quote</div>
                    </a>
                  )}
                  {project.invoice_url && (
                    <a 
                      href={project.invoice_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all"
                    >
                      <div className="text-[14px] font-medium text-[#111827]">Invoice</div>
                    </a>
                  )}
                  {project.handover_pdf_url && (
                    <a 
                      href={project.handover_pdf_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all"
                    >
                      <div className="text-[14px] font-medium text-[#111827]">Handover Report</div>
                    </a>
                  )}
                  {project.other_documents?.map((doc, idx) => (
                    <a 
                      key={idx}
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all"
                    >
                      <div className="text-[14px] font-medium text-[#111827]">{doc.name || `Document ${idx + 1}`}</div>
                    </a>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}