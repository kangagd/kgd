import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Camera, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import FilePreviewModal from "./FilePreviewModal";

export default function EditableFileUpload({ 
  files = [], 
  onFilesChange, 
  accept = "image/*",
  multiple = true,
  icon: Icon,
  label,
  emptyText = "No files uploaded"
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = selectedFiles.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(result => result.file_url);
      
      if (multiple) {
        onFilesChange([...files, ...newUrls]);
      } else {
        onFilesChange(newUrls[0]);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = droppedFiles.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(result => result.file_url);
      
      if (multiple) {
        onFilesChange([...files, ...newUrls]);
      } else {
        onFilesChange(newUrls[0]);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
    setUploading(false);
  };

  const handleRemove = (indexOrUrl) => {
    if (multiple) {
      onFilesChange(files.filter((_, index) => index !== indexOrUrl));
    } else {
      onFilesChange(null);
    }
  };

  const displayFiles = multiple ? files : (files ? [files] : []);
  const isImageUpload = accept.includes('image');

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-slate-400" />}
            {label}
          </h4>
          <div className="flex gap-2">
            {isImageUpload && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="h-7 text-xs"
              >
                <Camera className="w-3 h-3 mr-1" />
                Camera
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-7 text-xs"
            >
              {uploading ? (
                <>Uploading...</>
              ) : (
                <><Upload className="w-3 h-3 mr-1" />{multiple ? 'Add' : 'Upload'}</>
              )}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={handleFileSelect}
          />
          {isImageUpload && (
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple={multiple}
              className="hidden"
              onChange={handleFileSelect}
            />
          )}
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg transition-colors ${
            isDragging 
              ? 'border-orange-400 bg-orange-50' 
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          {displayFiles.length > 0 ? (
            isImageUpload && multiple ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
                {displayFiles.map((url, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={url} 
                      alt={`Upload ${index + 1}`} 
                      className="w-full h-24 md:h-32 object-cover rounded border cursor-pointer hover:opacity-80"
                      onClick={() => setPreviewFile(url)}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(index);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(url);
                      }}
                      className="absolute bottom-1 right-1 bg-white/90 text-slate-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3">
                <button
                  type="button"
                  onClick={() => setPreviewFile(displayFiles[0])}
                  className="text-xs md:text-sm text-blue-600 hover:underline flex items-center gap-2 flex-1"
                >
                  <Eye className="w-4 h-4" />
                  Preview File
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(0)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          ) : (
            <div 
              className="text-xs md:text-sm text-slate-400 text-center py-8 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>{emptyText}</p>
              <p className="text-xs text-slate-300 mt-1">or drag and drop files here</p>
            </div>
          )}
        </div>
      </div>

      <FilePreviewModal
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        fileUrl={previewFile}
      />
    </>
  );
}