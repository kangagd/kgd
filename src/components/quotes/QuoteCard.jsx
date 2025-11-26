import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Send, 
  ExternalLink, 
  Eye, 
  MoreHorizontal,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Mail
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import moment from "moment";

const statusConfig = {
  Draft: { color: 'bg-gray-100 text-gray-700', icon: FileText },
  Sent: { color: 'bg-blue-100 text-blue-700', icon: Mail },
  Viewed: { color: 'bg-purple-100 text-purple-700', icon: Eye },
  Accepted: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  Declined: { color: 'bg-red-100 text-red-700', icon: XCircle },
  Expired: { color: 'bg-orange-100 text-orange-700', icon: Clock }
};

export default function QuoteCard({ quote, onUpdate, isAdmin = false }) {
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const config = statusConfig[quote.status] || statusConfig.Draft;
  const StatusIcon = config.icon;

  const handleSend = async () => {
    setIsSending(true);
    try {
      const response = await base44.functions.invoke('sendPandaDocQuote', {
        quoteId: quote.id
      });

      if (response.data?.success) {
        toast.success('Quote sent to customer');
        onUpdate?.();
      } else {
        toast.error(response.data?.error || 'Failed to send quote');
      }
    } catch (error) {
      console.error('Send quote error:', error);
      toast.error('Failed to send quote');
    } finally {
      setIsSending(false);
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await base44.functions.invoke('getPandaDocQuoteStatus', {
        quoteId: quote.id
      });

      if (response.data?.success) {
        toast.success('Status refreshed');
        onUpdate?.();
      }
    } catch (error) {
      console.error('Refresh status error:', error);
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

  return (
    <Card className="border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-[14px] font-semibold text-[#111827] truncate">
                {quote.name}
              </h4>
              <Badge className={config.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {quote.status}
              </Badge>
            </div>

            {quote.number && (
              <p className="text-[12px] text-[#6B7280] mb-1">
                #{quote.number}
              </p>
            )}

            <div className="flex items-center gap-4 text-[12px] text-[#6B7280]">
              <span className="font-medium text-[#111827]">
                ${quote.value?.toFixed(2) || '0.00'} {quote.currency || 'AUD'}
              </span>
              <span>
                Created {moment(quote.created_date).format('D MMM YYYY')}
              </span>
              {quote.expires_at && (
                <span className={moment(quote.expires_at).isBefore(moment()) ? 'text-red-600' : ''}>
                  {moment(quote.expires_at).isBefore(moment()) ? 'Expired' : 'Expires'} {moment(quote.expires_at).format('D MMM')}
                </span>
              )}
            </div>

            {quote.sent_at && (
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                Sent {moment(quote.sent_at).format('D MMM YYYY h:mm A')}
              </p>
            )}
            {quote.viewed_at && (
              <p className="text-[11px] text-[#9CA3AF]">
                Viewed {moment(quote.viewed_at).format('D MMM YYYY h:mm A')}
              </p>
            )}
            {quote.accepted_at && (
              <p className="text-[11px] text-green-600">
                Accepted {moment(quote.accepted_at).format('D MMM YYYY h:mm A')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && quote.status === 'Draft' && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending}
                className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Send
                  </>
                )}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAdmin && quote.pandadoc_internal_url && (
                  <DropdownMenuItem onClick={openInPandaDoc}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in PandaDoc
                  </DropdownMenuItem>
                )}
                {quote.pandadoc_public_url && (
                  <DropdownMenuItem onClick={openPublicUrl}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Customer Link
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleRefreshStatus} disabled={isRefreshing}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh Status
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}