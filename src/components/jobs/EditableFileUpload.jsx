import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Camera, Video } from "lucide-react";
import { base44 } from "@/api/base44Client";
import FilePreviewModal from "../common/FilePreviewModal";

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
  const [previewFile, setPreviewFile] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelection = (index) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const handleBulkDelete = () => {
    const remainingFiles = files.filter((_, index) => !selectedIndices.has(index));
    onFilesChange(remainingFiles);
    setSelectedIndices(new Set());
    setIsSelectionMode(false);
  };

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

  // Filter out empty, null, undefined, or invalid URLs
  const validFiles = (multiple ? files : (files ? [files] : [])).filter(url => url && typeof url === 'string' && url.trim() !== '');
  const displayFiles = validFiles;
  const isMediaUpload = accept.includes('image') || accept.includes('video');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          {label}
        </h4>
        <div className="flex gap-2">
          {multiple && displayFiles.length > 0 && (
            <>
              {isSelectionMode ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={selectedIndices.size === 0}
                    className="h-7 text-xs"
                  >
                    Delete ({selectedIndices.size})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedIndices(new Set());
                    }}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsSelectionMode(true)}
                  className="h-7 text-xs"
                >
                  Select
                </Button>
              )}
            </>
          )}
          {(!isSelectionMode || !multiple) && (
            <>
              {accept.includes('image') && (
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
            </>
          )}
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
        className={`transition-colors ${isDragging ? 'bg-blue-50 border-blue-300' : ''}`}
      >
        {displayFiles.length > 0 ? (
          isMediaUpload && multiple ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {displayFiles.map((url, index) => (
                <div 
                  key={index} 
                  className={`relative group ${isSelectionMode ? 'cursor-pointer' : ''}`}
                  onClick={isSelectionMode ? (e) => {
                    e.preventDefault();
                    toggleSelection(index);
                  } : undefined}
                >
                  {isImageFile(url) ? (
                    <div className="w-full relative">
                      <img 
                        src={url} 
                        alt={`Upload ${index + 1}`} 
                        className={`w-full h-24 md:h-32 object-cover rounded border transition-all ${
                          isSelectionMode 
                            ? (selectedIndices.has(index) ? 'ring-2 ring-[#FAE008] opacity-80' : 'opacity-50 hover:opacity-70') 
                            : 'hover:opacity-80 cursor-pointer'
                        }`}
                        onClick={!isSelectionMode ? () => setPreviewFile({
                          url,
                          name: `Image ${index + 1}`,
                          type: 'image',
                          index
                        }) : undefined}
                      />
                    </div>
                  ) : isVideoFile(url) ? (
                    <div className={`relative w-full h-24 md:h-32 rounded border bg-slate-900 ${
                      isSelectionMode 
                        ? (selectedIndices.has(index) ? 'ring-2 ring-[#FAE008] opacity-80' : 'opacity-50 hover:opacity-70') 
                        : ''
                    }`}>
                      <video 
                        src={url}
                        className="w-full h-full object-cover rounded"
                        controls={!isSelectionMode}
                      />
                      <div className="absolute top-2 left-2 bg-black/70 rounded px-2 py-1">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div 
                      className={`flex items-center justify-center w-full h-24 md:h-32 bg-slate-100 rounded border transition-all ${
                        isSelectionMode 
                          ? (selectedIndices.has(index) ? 'ring-2 ring-[#FAE008] opacity-80' : 'opacity-50 hover:opacity-70') 
                          : 'hover:bg-slate-200 cursor-pointer'
                      }`}
                      onClick={!isSelectionMode ? () => setPreviewFile({
                        url,
                        name: `File ${index + 1}`,
                        type: 'pdf',
                        index
                      }) : undefined}
                    >
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  
                  {isSelectionMode && (
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded border bg-white flex items-center justify-center ${selectedIndices.has(index) ? 'border-[#FAE008] bg-[#FAE008]' : 'border-slate-300'}`}>
                      {selectedIndices.has(index) && <div className="w-2.5 h-2.5 bg-[#111827] rounded-sm" />}
                    </div>
                  )}

                  {!isSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(index);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <button
                onClick={() => setPreviewFile({
                  url: displayFiles[0],
                  name: label || 'File',
                  type: 'pdf',
                  index: 0
                })}
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
            className={`text-xs md:text-sm text-slate-400 text-center py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              isDragging 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-medium">{isDragging ? 'Drop files here' : emptyText}</p>
            <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
          </div>
        )}
      </div>

      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
        onDelete={previewFile ? () => handleRemove(previewFile.index) : null}
      />
    </div>
  );
}