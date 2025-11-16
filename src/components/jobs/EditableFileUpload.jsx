import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Camera, Video } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function EditableFileUpload({ 
  files = [], 
  onFilesChange, 
  accept = "image/*,video/*",
  multiple = true,
  icon: Icon,
  label,
  emptyText = "No files uploaded"
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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await uploadFiles(droppedFiles);
  };

  const handleRemove = (indexOrUrl) => {
    if (multiple) {
      onFilesChange(files.filter((_, index) => index !== indexOrUrl));
    } else {
      onFilesChange(null);
    }
  };

  const isImageFile = (url) => {
    return url && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
  };

  const isVideoFile = (url) => {
    return url && /\.(mp4|webm|ogg|mov|avi)$/i.test(url);
  };

  const displayFiles = multiple ? files : (files ? [files] : []);
  const isMediaUpload = accept.includes('image') || accept.includes('video');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#000000] flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-slate-500" />}
          {label}
        </h4>
        <div className="flex gap-2">
          {accept.includes('image') && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="h-9 text-xs font-semibold border-2"
            >
              <Camera className="w-4 h-4 mr-1.5" />
              <span className="hidden md:inline">Camera</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-9 text-xs font-semibold border-2"
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <><Upload className="w-4 h-4 mr-1.5" />{multiple ? 'Add' : 'Upload'}</>
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
        {accept.includes('image') && (
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
        className={`transition-all rounded-xl ${isDragging ? 'bg-blue-50 border-blue-400' : ''}`}
      >
        {displayFiles.length > 0 ? (
          isMediaUpload && multiple ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {displayFiles.map((url, index) => (
                <div key={index} className="relative group">
                  {isImageFile(url) ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={url} 
                        alt={`Upload ${index + 1}`} 
                        className="w-full h-32 object-cover rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:opacity-90 transition-all shadow-sm"
                      />
                    </a>
                  ) : isVideoFile(url) ? (
                    <div className="relative w-full h-32 rounded-xl border-2 border-slate-200 bg-slate-900 overflow-hidden">
                      <video 
                        src={url}
                        className="w-full h-full object-cover"
                        controls
                      />
                      <div className="absolute top-2 left-2 bg-black/70 rounded-lg px-2 py-1">
                        <Video className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ) : (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-32 bg-slate-100 rounded-xl border-2 border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-all">
                      <Upload className="w-8 h-8 text-slate-400" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
              <a 
                href={displayFiles[0]} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex-1 font-semibold"
              >
                View File
              </a>
              <button
                type="button"
                onClick={() => handleRemove(0)}
                className="text-red-500 hover:text-red-700 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )
        ) : (
          <div 
            className={`text-sm text-center py-12 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              isDragging 
                ? 'border-blue-400 bg-blue-50 shadow-md' 
                : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-[#000000]">{isDragging ? 'Drop files here' : emptyText}</p>
            <p className="text-sm text-slate-500 mt-2">or drag and drop</p>
          </div>
        )}
      </div>
    </div>
  );
}