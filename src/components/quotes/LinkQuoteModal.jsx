import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Search, Loader2, Link2, FileText, Check, ExternalLink } from "lucide-react";
import moment from "moment";

const statusColors = {
  'document.draft': 'bg-gray-100 text-gray-700',
  'document.uploaded': 'bg-gray-100 text-gray-700',
  'document.sent': 'bg-blue-100 text-blue-700',
  'document.viewed': 'bg-purple-100 text-purple-700',
  'document.completed': 'bg-green-100 text-green-700',
  'document.voided': 'bg-red-100 text-red-700',
  'document.declined': 'bg-red-100 text-red-700'
};

export default function LinkQuoteModal({ 
  isOpen, 
  onClose, 
  project = null, 
  job = null,
  onQuoteLinked 
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  const loadDocuments = async (searchTerm = '') => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('listPandaDocDocuments', {
        search: searchTerm,
        count: 50,
        projectId: project?.id || null
      });
      if (response.data?.documents) {
        setDocuments(response.data.documents);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load PandaDoc documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadDocuments(search);
  };

  const handleLink = async () => {
    if (!selectedDoc) return;

    setLinking(true);
    try {
      const response = await base44.functions.invoke('linkPandaDocQuote', {
        pandadocDocumentId: selectedDoc.id,
        projectId: project?.id || null,
        jobId: job?.id || null
      });

      if (response.data?.success) {
        toast.success('Quote linked successfully');
        onQuoteLinked?.(response.data.quote);
        onClose();
        setSelectedDoc(null);
        setSearch('');
      } else {
        toast.error(response.data?.error || 'Failed to link quote');
      }
    } catch (error) {
      console.error('Link quote error:', error);
      toast.error('Failed to link quote');
    } finally {
      setLinking(false);
    }
  };

  const formatStatus = (status) => {
    return status?.replace('document.', '').replace('_', ' ') || 'Unknown';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#FAE008]" />
            Link Existing PandaDoc Quote
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button type="button" onClick={handleSearch} variant="outline" disabled={loading}>
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Documents List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#6B7280]" />
                <span className="ml-2 text-[14px] text-[#6B7280]">Loading documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-[#6B7280]">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-[14px]">No documents found</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => !doc.is_linked && setSelectedDoc(doc)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    doc.is_linked 
                      ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                      : selectedDoc?.id === doc.id 
                        ? 'border-[#FAE008] bg-[#FFFEF5] shadow-sm' 
                        : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {selectedDoc?.id === doc.id && (
                          <Check className="w-4 h-4 text-[#FAE008]" />
                        )}
                        <h4 className="text-[14px] font-medium text-[#111827] truncate">
                          {doc.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                        <Badge className={statusColors[doc.status] || 'bg-gray-100 text-gray-700'}>
                          {formatStatus(doc.status)}
                        </Badge>
                        {doc.grand_total?.amount && (
                          <span className="font-medium text-[#111827]">
                            ${doc.grand_total.amount.toFixed(2)}
                          </span>
                        )}
                        <span>
                          {moment(doc.date_modified || doc.date_created).format('D MMM YYYY')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.is_linked && (
                        <Badge variant="outline" className="text-[11px]">
                          Already Linked
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://app.pandadoc.com/a/#/documents/${doc.id}`, '_blank');
                        }}
                      >
                        <ExternalLink className="w-4 h-4 text-[#6B7280]" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={linking}>
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleLink} 
            disabled={!selectedDoc || linking}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            {linking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 mr-2" />
                Link Quote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}