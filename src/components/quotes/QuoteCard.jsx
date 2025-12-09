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
  Mail,
  Copy,
  RotateCw,
  Unlink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import moment from "moment";

const statusConfig = {
  Draft: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileText },
  Sent: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Mail },
  Viewed: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Eye },
  Accepted: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  Declined: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  Expired: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock }
};

export default function QuoteCard({ quote, onUpdate, onSelect, isAdmin = false, isCompact = false, onRefreshLink }) {
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingLink, setIsLoadingLink] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const config = statusConfig[quote.status] || statusConfig.Draft;
  const StatusIcon = config.icon;

  const handleSend = async (e) => {
    e?.stopPropagation();
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

  const handleRefreshStatus = async (e) => {
    e?.stopPropagation();
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

  const openInPandaDoc = (e) => {
    e?.stopPropagation();
    if (quote.pandadoc_internal_url) {
      window.open(quote.pandadoc_internal_url, '_blank');
    }
  };

  const openPublicUrl = async (e) => {
    e?.stopPropagation();
    if (quote.pandadoc_document_id && onRefreshLink) {
      setIsLoadingLink(true);
      try {
        const freshUrl = await onRefreshLink(quote);
        if (freshUrl) {
          window.open(freshUrl, '_blank');
        } else {
          toast.error('Could not generate client link');
        }
      } catch (error) {
        toast.error('Failed to open client view');
      } finally {
        setIsLoadingLink(false);
      }
    } else if (quote.pandadoc_public_url) {
      window.open(quote.pandadoc_public_url, '_blank');
    }
  };

  const copyClientLink = async (e) => {
    e?.stopPropagation();
    if (quote.pandadoc_document_id && onRefreshLink) {
      setIsLoadingLink(true);
      try {
        const freshUrl = await onRefreshLink(quote);
        if (freshUrl) {
          await navigator.clipboard.writeText(freshUrl);
          toast.success('Client link copied to clipboard');
        } else {
          toast.error('Could not generate client link');
        }
      } catch (error) {
        toast.error('Failed to copy link');
      } finally {
        setIsLoadingLink(false);
      }
    } else if (quote.pandadoc_public_url) {
      await navigator.clipboard.writeText(quote.pandadoc_public_url);
      toast.success('Client link copied to clipboard');
    } else {
      toast.error('No client link available');
    }
  };

  const handleUnlink = async (e) => {
    e?.stopPropagation();
    if (!confirm('Unlink this quote? This will remove it from the project and you can re-link it later if needed.')) {
      return;
    }

    setIsUnlinking(true);
    try {
      const response = await base44.functions.invoke('unlinkQuote', {
        quoteId: quote.id
      });

      if (response.data?.success) {
        toast.success('Quote unlinked successfully');
        onUpdate?.();
      } else {
        toast.error(response.data?.error || 'Failed to unlink quote');
      }
    } catch (error) {
      console.error('Unlink quote error:', error);
      toast.error('Failed to unlink quote');
    } finally {
      setIsUnlinking(false);
    }
  };

  // Compact view for technicians
  if (isCompact) {
    return (
      <div className="p-3 bg-white border border-[#E5E7EB] rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-[14px] font-medium text-[#111827] truncate">
                {quote.name}
              </h4>
              <Badge className={`${config.color} border text-[11px]`}>
                {quote.status}
              </Badge>
            </div>
            <p className="text-[13px] font-semibold text-[#111827]">
              ${quote.value?.toFixed(2) || '0.00'} {quote.currency || 'AUD'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card 
      className={`border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all hover:shadow-sm ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(quote)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h4 className="text-[14px] font-semibold text-[#111827]">
                {quote.name}
              </h4>
              {quote.number && (
                <span className="text-[12px] text-[#6B7280]">#{quote.number}</span>
              )}
              <Badge className={`${config.color} border`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {quote.status}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-[13px] mb-2">
              <span className="font-semibold text-[#111827]">
                ${quote.value?.toFixed(2) || '0.00'} {quote.currency || 'AUD'}
              </span>
              <span className="text-[#6B7280]">
                Created {moment(quote.created_date).format('D MMM YYYY')}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#9CA3AF]">
              {quote.sent_at && (
                <span>Sent {moment(quote.sent_at).format('D MMM h:mm A')}</span>
              )}
              {quote.viewed_at && (
                <span className="text-purple-600">Viewed {moment(quote.viewed_at).format('D MMM h:mm A')}</span>
              )}
              {quote.accepted_at && (
                <span className="text-green-600 font-medium">Accepted {moment(quote.accepted_at).format('D MMM h:mm A')}</span>
              )}
              {quote.declined_at && (
                <span className="text-red-600">Declined {moment(quote.declined_at).format('D MMM h:mm A')}</span>
              )}
              {quote.expires_at && !quote.accepted_at && (
                <span className={moment(quote.expires_at).isBefore(moment()) ? 'text-red-600' : 'text-[#9CA3AF]'}>
                  {moment(quote.expires_at).isBefore(moment()) ? 'Expired' : 'Expires'} {moment(quote.expires_at).format('D MMM')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && quote.status === 'Draft' && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending}
                className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] h-8"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Send
                  </>
                )}
              </Button>
            )}

            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {quote.pandadoc_internal_url && (
                    <DropdownMenuItem onClick={openInPandaDoc}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in PandaDoc
                    </DropdownMenuItem>
                  )}
                  {quote.pandadoc_document_id && (
                    <>
                      <DropdownMenuItem onClick={openPublicUrl} disabled={isLoadingLink}>
                        {isLoadingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                        View as Client
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyClientLink} disabled={isLoadingLink}>
                        {isLoadingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                        Copy Client Link
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleRefreshStatus} disabled={isRefreshing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </DropdownMenuItem>
                  {quote.status === 'Sent' && (
                    <DropdownMenuItem onClick={openInPandaDoc}>
                      <RotateCw className="w-4 h-4 mr-2" />
                      Resend (via PandaDoc)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleUnlink} disabled={isUnlinking} className="text-red-600 focus:text-red-600">
                    {isUnlinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
                    Unlink Quote
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}