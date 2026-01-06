import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

export default function ProjectImportModal({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: validate, 4: import
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFile(selectedFile);
    
    // Upload file
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setFileUrl(uploadResponse.file_url);
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload file');
      console.error(error);
    }
  };

  const handleParseCSV = async () => {
    if (!fileUrl) return;

    try {
      const response = await base44.functions.invoke('importProjects', {
        action: 'parse_csv',
        file_url: fileUrl
      });

      if (response.data.error) {
        toast.error(response.data.error);
        return;
      }

      setPreviewData(response.data);
      setStep(2);
    } catch (error) {
      toast.error('Failed to parse CSV');
      console.error(error);
    }
  };

  const handleValidate = async () => {
    if (!previewData) return;

    try {
      // Parse entire CSV to get all records
      const response = await fetch(fileUrl);
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      const records = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      const validationResponse = await base44.functions.invoke('importProjects', {
        action: 'validate',
        records_to_import: records
      });

      if (validationResponse.data.error) {
        toast.error(validationResponse.data.error);
        return;
      }

      setValidation(validationResponse.data.validation);
      setStep(3);
    } catch (error) {
      toast.error('Failed to validate records');
      console.error(error);
    }
  };

  const handleImport = async () => {
    if (!validation) return;

    setImporting(true);
    try {
      // Parse entire CSV again for import
      const response = await fetch(fileUrl);
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      const records = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      const importResponse = await base44.functions.invoke('importProjects', {
        action: 'import',
        records_to_import: records
      });

      if (importResponse.data.error) {
        toast.error(importResponse.data.error);
        return;
      }

      setResults(importResponse.data.results);
      setStep(4);
      toast.success(`Successfully imported ${importResponse.data.results.created} projects`);
    } catch (error) {
      toast.error('Failed to import records');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setFileUrl(null);
    setPreviewData(null);
    setValidation(null);
    setResults(null);
    setImporting(false);
    onClose();
  };

  const handleComplete = () => {
    handleClose();
    if (onSuccess) onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Projects</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-[#6B7280]" />
              <p className="text-sm text-[#6B7280] mb-4">
                Upload a CSV file with your project data
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
            </div>

            {file && (
              <div className="bg-[#F9FAFB] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{file.name}</p>
                    <p className="text-xs text-[#6B7280]">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <Button onClick={handleParseCSV} disabled={!fileUrl}>
                    Next: Preview Data
                  </Button>
                </div>
              </div>
            )}

            <div className="text-xs text-[#6B7280] space-y-1">
              <p><strong>Required column:</strong> title</p>
              <p><strong>Optional columns:</strong> customer_id, customer_name, status, project_type, opened_date, completed_date, lost_date, address, notes, etc.</p>
              <p><strong>Date format:</strong> YYYY-MM-DD (e.g., 2025-01-15)</p>
            </div>
          </div>
        )}

        {step === 2 && previewData && (
          <div className="space-y-4">
            <div className="bg-[#F9FAFB] rounded-lg p-4">
              <p className="text-sm font-medium text-[#111827] mb-2">
                Found {previewData.total_rows} rows (showing first 5)
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      {previewData.headers.map((header, idx) => (
                        <th key={idx} className="text-left p-2 font-medium text-[#6B7280]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview_rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#E5E7EB]">
                        {previewData.headers.map((header, cellIdx) => (
                          <td key={cellIdx} className="p-2 text-[#111827]">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleValidate}>Next: Validate Records</Button>
            </div>
          </div>
        )}

        {step === 3 && validation && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-green-700">{validation.valid.length}</p>
                <p className="text-xs text-green-600">Valid</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                <p className="text-2xl font-bold text-yellow-700">{validation.warnings.length}</p>
                <p className="text-xs text-yellow-600">Warnings</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <X className="w-8 h-8 mx-auto mb-2 text-red-600" />
                <p className="text-2xl font-bold text-red-700">{validation.invalid.length}</p>
                <p className="text-xs text-red-600">Invalid</p>
              </div>
            </div>

            {validation.invalid.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-red-800 mb-2">Invalid Records:</p>
                <ul className="space-y-1 text-xs text-red-700">
                  {validation.invalid.map((item, idx) => (
                    <li key={idx}>
                      <strong>{item.title || item.record.title}:</strong> {item.issues?.join(', ') || item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-yellow-800 mb-2">Warnings:</p>
                <ul className="space-y-1 text-xs text-yellow-700">
                  {validation.warnings.map((item, idx) => (
                    <li key={idx}>
                      <strong>{item.title}:</strong> {item.warnings.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleImport} 
                disabled={importing || validation.valid.length === 0}
              >
                {importing ? 'Importing...' : `Import ${validation.valid.length + validation.warnings.length} Projects`}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && results && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">Import Complete!</h3>
              <p className="text-sm text-green-700">
                Successfully imported {results.created} projects
              </p>
              {results.skipped > 0 && (
                <p className="text-sm text-yellow-700 mt-2">
                  Skipped {results.skipped} records
                </p>
              )}
            </div>

            {results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                <ul className="space-y-1 text-xs text-red-700">
                  {results.errors.map((err, idx) => (
                    <li key={idx}>
                      <strong>{err.record}:</strong> {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleComplete}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}