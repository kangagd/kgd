import React, { useState } from "react";
import { X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function MediaDocumentsDrawer({ open, onClose, project }) {
  const [activeTab, setActiveTab] = useState("photos");

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
            <Button
              size="sm"
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
            <button
              onClick={onClose}
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
              <div className="text-center py-12 text-[#9CA3AF]">
                <p className="text-[14px]">No photos yet</p>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="p-4">
              <div className="text-center py-12 text-[#9CA3AF]">
                <p className="text-[14px]">No documents yet</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}