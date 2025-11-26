import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  ExternalLink, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail,
  Copy,
  Calendar,
  DollarSign,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import moment from "moment";
import { base44 } from "@/api/base44Client";

const statusConfig = {
  Draft: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileText, label: 'Draft' },
  Sent: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Mail, label: 'Sent' },
  Viewed: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Eye, label: 'Viewed' },
  Accepted: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, label: 'Accepted' },
  Declined: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Declined' },
  Expired: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock, label: 'Expired' }
};

export default function QuoteSummaryModal({ quote, isOpen, onClose, isAdmin = false, onQuoteUpdated }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!quote) return null;

  const config = statusConfig[quote.status] || statusConfig.Draft;
  const StatusIcon = config.icon;

  const refreshFromPandaDoc = async () => {
    setIsRefreshing(true);
    try {
      const response = await base44.functions.invoke('refreshQuoteFromPandaDoc', { quoteId: quote.id });
      if (response.data.success) {
        toast.success(`Refreshed quote with ${response.data.line_items_count} line items`);
        if (onQuoteUpdated) {
          onQuoteUpdated(response.data.quote);
        }
      } else {
        toast.error(response.data.error || 'Failed to refresh quote');
      }
    } catch (error) {
      toast.error('Failed to refresh from PandaDoc');
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openInPandaDoc = () => {
    if (quote.pandadoc_internal_url) {
      window.open(quote.pandadoc_internal_url, '_blank');
    }
  };

  const openPublicUrl = () => {
    if (quote.pandadoc_public_url) {
      window.open(quote.pandadoc_public_url, '_blank');
    }
  };

  const copyClientLink = async () => {
    if (quote.pandadoc_public_url) {
      await navigator.clipboard.writeText(quote.pandadoc_public_url);
      toast.success('Client link copied to clipboard');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FAE008]" />
            Quote Summary
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quote Name & Status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-[#111827]">{quote.name}</h3>
              {quote.number && (
                <p className="text-[13px] text-[#6B7280]">#{quote.number}</p>
              )}
            </div>
            <Badge className={`${config.color} border px-3 py-1`}>
              <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
              {config.label}
            </Badge>
          </div>

          {/* Value */}
          <div className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg">
            <DollarSign className="w-5 h-5 text-[#6B7280]" />
            <div>
              <p className="text-[12px] text-[#6B7280]">Quote Value</p>
              <p className="text-[18px] font-bold text-[#111827]">
                ${quote.value?.toFixed(2) || '0.00'} {quote.currency || 'AUD'}
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[13px]">
              <Calendar className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-[#6B7280]">Created:</span>
              <span className="text-[#111827] font-medium">
                {moment(quote.created_date).format('D MMM YYYY, h:mm A')}
              </span>
            </div>

            {quote.sent_at && (
              <div className="flex items-center gap-3 text-[13px]">
                <Mail className="w-4 h-4 text-blue-500" />
                <span className="text-[#6B7280]">Sent:</span>
                <span className="text-[#111827] font-medium">
                  {moment(quote.sent_at).format('D MMM YYYY, h:mm A')}
                </span>
              </div>
            )}

            {quote.viewed_at && (
              <div className="flex items-center gap-3 text-[13px]">
                <Eye className="w-4 h-4 text-purple-500" />
                <span className="text-[#6B7280]">Viewed:</span>
                <span className="text-[#111827] font-medium">
                  {moment(quote.viewed_at).format('D MMM YYYY, h:mm A')}
                </span>
              </div>
            )}

            {quote.accepted_at && (
              <div className="flex items-center gap-3 text-[13px]">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-[#6B7280]">Accepted:</span>
                <span className="text-green-600 font-medium">
                  {moment(quote.accepted_at).format('D MMM YYYY, h:mm A')}
                </span>
              </div>
            )}

            {quote.declined_at && (
              <div className="flex items-center gap-3 text-[13px]">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-[#6B7280]">Declined:</span>
                <span className="text-red-600 font-medium">
                  {moment(quote.declined_at).format('D MMM YYYY, h:mm A')}
                </span>
              </div>
            )}

            {quote.expires_at && (
              <div className="flex items-center gap-3 text-[13px]">
                <Clock className={`w-4 h-4 ${moment(quote.expires_at).isBefore(moment()) ? 'text-red-500' : 'text-[#9CA3AF]'}`} />
                <span className="text-[#6B7280]">
                  {moment(quote.expires_at).isBefore(moment()) ? 'Expired:' : 'Expires:'}
                </span>
                <span className={`font-medium ${moment(quote.expires_at).isBefore(moment()) ? 'text-red-600' : 'text-[#111827]'}`}>
                  {moment(quote.expires_at).format('D MMM YYYY')}
                </span>
              </div>
            )}
          </div>

          {/* Customer Info */}
          {(quote.customer_name || quote.customer_email) && (
            <div className="p-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-[12px] text-[#6B7280] mb-1">Customer</p>
              <p className="text-[14px] font-medium text-[#111827]">{quote.customer_name}</p>
              {quote.customer_email && (
                <p className="text-[13px] text-[#6B7280]">{quote.customer_email}</p>
              )}
            </div>
          )}

          {/* Line Items / Products */}
          {quote.line_items && quote.line_items.length > 0 && (
            <div>
              <p className="text-[12px] text-[#6B7280] mb-2">Products & Services</p>
              <div className="bg-[#F9FAFB] rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left py-2 px-3 font-medium text-[#6B7280]">Item</th>
                      <th className="text-right py-2 px-3 font-medium text-[#6B7280] w-16">Qty</th>
                      <th className="text-right py-2 px-3 font-medium text-[#6B7280] w-24">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.line_items.map((item, index) => (
                      <tr key={index} className="border-b border-[#E5E7EB] last:border-b-0">
                        <td className="py-2 px-3">
                          <p className="font-medium text-[#111827]">{item.name}</p>
                          {item.description && (
                            <p className="text-[11px] text-[#6B7280]">{item.description}</p>
                          )}
                        </td>
                        <td className="text-right py-2 px-3 text-[#111827]">{item.quantity || 1}</td>
                        <td className="text-right py-2 px-3 text-[#111827]">${(item.price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Internal Notes */}
          {quote.notes_internal && (
            <div>
              <p className="text-[12px] text-[#6B7280] mb-1">Internal Notes</p>
              <p className="text-[14px] text-[#111827]">{quote.notes_internal}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {quote.pandadoc_public_url && (
            <>
              <Button variant="outline" onClick={openPublicUrl} className="flex-1 min-w-[120px]">
                <Eye className="w-4 h-4 mr-2" />
                View as Client
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={copyClientLink} className="flex-1 min-w-[120px]">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              )}
            </>
          )}
          {isAdmin && quote.pandadoc_internal_url && (
            <Button onClick={openInPandaDoc} className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] flex-1 min-w-[120px]">
              <ExternalLink className="w-4 h-4 mr-2" />
              PandaDoc
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}