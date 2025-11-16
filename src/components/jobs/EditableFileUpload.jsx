import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Camera } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function EditableFileUpload({ 
  files = [], 
  onFilesChange, 
  accept = "image/*",
  multiple = true,
  icon: Icon,
  label,
  emptyText = "No files uploaded",
  onPreview
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFiles = async (selectedFiles) => {
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
  };

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    await uploadFiles(selectedFiles);
    e.target.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    await uploadFiles(droppedFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          {label}
        </h4>
        <div className="flex items-center gap-2">
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
              <span className="hidden md:inline">Camera</span>
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
            className="hidden"
            onChange={handleFileSelect}
          />
        )}
      </div>

      {displayFiles.length > 0 ? (
        accept.includes('image') && multiple ? (
          <div 
            className={`grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border-2 border-dashed rounded-lg transition-colors ${
              isDragging ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {displayFiles.map((url, index) => (
              <div key={index} className="relative group">
                <img 
                  src={url} 
                  alt={`Upload ${index + 1}`} 
                  className="w-full h-24 md:h-32 object-cover rounded border hover:opacity-80 cursor-pointer"
                  onClick={() => onPreview && onPreview(index)}
                />
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <button
              type="button"
              onClick={() => onPreview && onPreview(0)}
              className="text-xs md:text-sm text-blue-600 hover:underline flex-1 text-left"
            >
              View File
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
          className={`text-xs md:text-sm text-slate-400 text-center py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isDragging ? (
            <p className="text-orange-600 font-medium">Drop files here</p>
          ) : (
            <div>
              <p>{emptyText}</p>
              <p className="text-xs text-slate-400 mt-1">or drag and drop files here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}