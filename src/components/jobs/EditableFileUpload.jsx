import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
  const [uploading, setUploading] = React.useState(false);

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

  const handleRemove = (indexOrUrl) => {
    if (multiple) {
      onFilesChange(files.filter((_, index) => index !== indexOrUrl));
    } else {
      onFilesChange(null);
    }
  };

  const displayFiles = multiple ? files : (files ? [files] : []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          {label}
        </h4>
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
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {displayFiles.length > 0 ? (
        accept.includes('image') && multiple ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {displayFiles.map((url, index) => (
              <div key={index} className="relative group">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={url} 
                    alt={`Upload ${index + 1}`} 
                    className="w-full h-24 md:h-32 object-cover rounded border hover:opacity-80"
                  />
                </a>
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
            <a 
              href={displayFiles[0]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs md:text-sm text-blue-600 hover:underline flex-1"
            >
              View File
            </a>
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
        <p className="text-xs md:text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors"
           onClick={() => fileInputRef.current?.click()}>
          {emptyText}
        </p>
      )}
    </div>
  );
}