import React, { useState, useRef } from "react";
import { X, Upload, Download, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import RenameDocumentModal from "../common/RenameDocumentModal";

export default function MediaDocumentsDrawer({ open, onClose, project, initialTab = "photos", onUploadPhotos, onUploadDocuments, onDeleteImage, onDeleteDocument }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(null);
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

  const handleDownloadImage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(fullscreenImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${fullscreenIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download image');
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
              accept="image/*,video/*"
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
                <TabsTrigger value="photos" className="flex-1">Photos & Videos</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="photos" className="p-4">
              {!project.image_urls || project.image_urls.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <p className="text-[14px]">No photos or videos yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {project.image_urls.map((url, idx) => {
                    const isVideo = url.match(/\.(mp4|mov|avi|webm|mkv)$/i);
                    return (
                      <div 
                        key={idx} 
                        className="relative aspect-square rounded-lg overflow-hidden border border-[#E5E7EB] hover:border-[#FAE008] transition-colors cursor-pointer group"
                        onClick={() => !isVideo && setFullscreenImage(url) && setFullscreenIndex(idx)}
                      >
                        {isVideo ? (
                          <video 
                            src={url} 
                            className="w-full h-full object-cover"
                            controls
                          />
                        ) : (
                          <img 
                            src={url} 
                            alt={`Media ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      </div>
                    );
                  })}
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
                    <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all group">
                      <a 
                        href={project.quote_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 text-[14px] font-medium text-[#111827]"
                      >
                        Quote
                      </a>
                      {onDeleteDocument && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDocument('quote_url');
                          }}
                          className="ml-2 p-1.5 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {project.invoice_url && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all group">
                      <a 
                        href={project.invoice_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 text-[14px] font-medium text-[#111827]"
                      >
                        Invoice
                      </a>
                      {onDeleteDocument && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDocument('invoice_url');
                          }}
                          className="ml-2 p-1.5 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {project.handover_pdf_url && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all group">
                      <a 
                        href={project.handover_pdf_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 text-[14px] font-medium text-[#111827]"
                      >
                        Handover Report
                      </a>
                      {onDeleteDocument && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDocument('handover_pdf_url');
                          }}
                          className="ml-2 p-1.5 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {project.other_documents?.map((doc, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all group"
                    >
                      <a 
                        href={doc.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 text-[14px] font-medium text-[#111827]"
                      >
                        {doc.name || `Document ${idx + 1}`}
                      </a>
                      {onDeleteDocument && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDocument('other_documents', idx);
                          }}
                          className="ml-2 p-1.5 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <>
          <div 
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
            onClick={() => setFullscreenImage(null)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-[90vh] flex items-center">
              <img 
                src={fullscreenImage} 
                alt="Full view"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={handleDownloadImage}
                  className="flex items-center justify-center h-9 w-9 bg-white hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] rounded-lg transition-all"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                {onDeleteImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteImage(fullscreenIndex);
                      setFullscreenImage(null);
                    }}
                    className="flex items-center justify-center h-9 w-9 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenImage(null);
                  }}
                  className="flex items-center justify-center h-9 w-9 bg-white hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] rounded-lg transition-all"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}