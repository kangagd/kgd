import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import { Upload, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const CUSTOMER_FIELDS = [
  { value: 'name', label: 'Name *', required: true },
  { value: 'customer_type', label: 'Customer Type' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'secondary_phone', label: 'Secondary Phone' },
  { value: 'address_full', label: 'Address' },
  { value: 'address_street', label: 'Street' },
  { value: 'address_suburb', label: 'Suburb' },
  { value: 'address_state', label: 'State' },
  { value: 'address_postcode', label: 'Postcode' },
  { value: 'sp_number', label: 'SP Number' },
  { value: 'source', label: 'Source' },
  { value: 'source_details', label: 'Source Details' },
  { value: 'notes', label: 'Notes' },
  { value: 'skip', label: '-- Skip Column --' }
];

export default function CustomerImportWizard({ open, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicateChecks, setDuplicateChecks] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState({});
  const [importResults, setImportResults] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setFileUrl(file_url);
      
      // Parse CSV
      setIsParsing(true);
      const response = await base44.functions.invoke('importCustomers', {
        action: 'parse_csv',
        file_url
      });

      setCsvHeaders(response.data.headers);
      setPreviewRows(response.data.preview_rows);
      setTotalRows(response.data.total_rows);
      
      // Auto-map common column names
      const autoMapping = {};
      response.data.headers.forEach(header => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('name') && !lowerHeader.includes('organization')) {
          autoMapping[header] = 'name';
        } else if (lowerHeader.includes('phone') && !lowerHeader.includes('secondary')) {
          autoMapping[header] = 'phone';
        } else if (lowerHeader.includes('email')) {
          autoMapping[header] = 'email';
        } else if (lowerHeader.includes('address') || lowerHeader.includes('street')) {
          autoMapping[header] = 'address_full';
        } else if (lowerHeader.includes('suburb') || lowerHeader.includes('city')) {
          autoMapping[header] = 'address_suburb';
        } else if (lowerHeader.includes('state')) {
          autoMapping[header] = 'address_state';
        } else if (lowerHeader.includes('postcode') || lowerHeader.includes('zip')) {
          autoMapping[header] = 'address_postcode';
        } else if (lowerHeader.includes('type') || lowerHeader.includes('category')) {
          autoMapping[header] = 'customer_type';
        }
      });
      
      setColumnMapping(autoMapping);
      setStep(2);
    } catch (error) {
      toast.error(error.message || 'Failed to parse CSV');
    } finally {
      setIsUploading(false);
      setIsParsing(false);
    }
  };

  const handleNext = async () => {
    if (step === 2) {
      // Validate mapping - name is required
      const hasNameMapping = Object.values(columnMapping).includes('name');
      if (!hasNameMapping) {
        toast.error('Please map at least the Name column');
        return;
      }

      // Parse full CSV and check for duplicates
      setIsChecking(true);
      try {
        const response = await fetch(fileUrl);
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim());
        
        const records = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const record = {};
          
          csvHeaders.forEach((header, idx) => {
            const mappedField = columnMapping[header];
            if (mappedField && mappedField !== 'skip') {
              record[mappedField] = values[idx] || '';
            }
          });

          return record;
        }).filter(r => r.name); // Filter out rows without name

        // Check for duplicates
        const duplicateResponse = await base44.functions.invoke('importCustomers', {
          action: 'check_duplicates',
          records_to_import: records
        });

        setDuplicateChecks(duplicateResponse.data.duplicate_checks);
        
        // Auto-select all non-duplicate records
        const initialSelection = {};
        duplicateResponse.data.duplicate_checks.forEach((check, idx) => {
          initialSelection[idx] = !check.has_duplicates;
        });
        setSelectedRecords(initialSelection);
        
        setStep(3);
      } catch (error) {
        toast.error(error.message || 'Failed to check duplicates');
      } finally {
        setIsChecking(false);
      }
    } else if (step === 3) {
      // Import selected records
      const recordsToImport = duplicateChecks
        .filter((_, idx) => selectedRecords[idx])
        .map(check => check.record);

      if (recordsToImport.length === 0) {
        toast.error('Please select at least one record to import');
        return;
      }

      setIsImporting(true);
      try {
        const response = await base44.functions.invoke('importCustomers', {
          action: 'import',
          records_to_import: recordsToImport
        });

        setImportResults(response.data.results);
        setStep(4);
      } catch (error) {
        toast.error(error.message || 'Failed to import customers');
      } finally {
        setIsImporting(false);
      }
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setFileUrl(null);
    setCsvHeaders([]);
    setPreviewRows([]);
    setColumnMapping({});
    setDuplicateChecks([]);
    setSelectedRecords({});
    setImportResults(null);
    onClose();
  };

  const handleComplete = () => {
    handleClose();
    onComplete();
  };

  const selectedCount = Object.values(selectedRecords).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Import Customers from CSV</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                step >= s ? 'bg-[#FAE008] text-[#111827]' : 'bg-[#E5E7EB] text-[#6B7280]'
              }`}>
                {s}
              </div>
              {s < 4 && (
                <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-[#FAE008]' : 'bg-[#E5E7EB]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Upload className="w-16 h-16 text-[#6B7280] mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
              <p className="text-sm text-[#6B7280] mb-6">
                Select a CSV file containing customer data
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button asChild className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]">
                  <span>
                    {isUploading || isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>Map your CSV columns</strong> to customer fields. Preview shows first 5 rows from {totalRows} total.
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {csvHeaders.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <div className="w-1/3">
                    <Label className="text-sm font-semibold">{header}</Label>
                    <div className="text-xs text-[#6B7280] mt-1">
                      {previewRows[0]?.[header] || '(empty)'}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#6B7280]" />
                  <div className="flex-1">
                    <Select
                      value={columnMapping[header] || 'skip'}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, [header]: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                disabled={isChecking}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    Next: Check Duplicates
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Select */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-900">
                <strong>{duplicateChecks.length} records</strong> ready for import. 
                {duplicateChecks.filter(c => c.has_duplicates).length > 0 && (
                  <> <strong>{duplicateChecks.filter(c => c.has_duplicates).length}</strong> potential duplicates detected.</>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-[#6B7280]">
                {selectedCount} of {duplicateChecks.length} selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = {};
                    duplicateChecks.forEach((_, idx) => { all[idx] = true; });
                    setSelectedRecords(all);
                  }}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const onlyUnique = {};
                    duplicateChecks.forEach((check, idx) => {
                      onlyUnique[idx] = !check.has_duplicates;
                    });
                    setSelectedRecords(onlyUnique);
                  }}
                >
                  Unique Only
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {duplicateChecks.map((check, idx) => (
                <Card 
                  key={idx}
                  className={`${
                    check.has_duplicates 
                      ? 'border-amber-300 bg-amber-50' 
                      : 'border-[#E5E7EB]'
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedRecords[idx] || false}
                        onCheckedChange={(checked) => 
                          setSelectedRecords({ ...selectedRecords, [idx]: checked })
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-[#111827]">
                            {check.record.name}
                          </span>
                          {check.has_duplicates && (
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Duplicate
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-[#6B7280] space-y-1">
                          {check.record.phone && <div>📞 {check.record.phone}</div>}
                          {check.record.email && <div>✉️ {check.record.email}</div>}
                          {check.record.address_full && <div>📍 {check.record.address_full}</div>}
                        </div>
                        {check.has_duplicates && check.matches.length > 0 && (
                          <div className="mt-2 p-2 bg-white rounded border border-amber-200">
                            <div className="text-xs font-semibold text-amber-900 mb-1">
                              Similar to:
                            </div>
                            {check.matches.map((match, mIdx) => (
                              <div key={mIdx} className="text-xs text-[#6B7280]">
                                • {match.name} {match.phone && `(${match.phone})`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                disabled={selectedCount === 0 || isImporting}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {selectedCount} Customer{selectedCount !== 1 ? 's' : ''}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && importResults && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
              <div className="space-y-2">
                <p className="text-sm text-[#6B7280]">
                  <strong className="text-green-600">{importResults.created}</strong> customers created
                </p>
                {importResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                    <p className="text-sm font-semibold text-red-900 mb-2">
                      {importResults.errors.length} error{importResults.errors.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {importResults.errors.map((err, idx) => (
                        <div key={idx} className="text-xs text-red-700">
                          • {err.record}: {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center pt-4 border-t">
              <Button 
                onClick={handleComplete}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}