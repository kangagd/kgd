import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, ExternalLink, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function QuotesInvoicesSection({ quotes, invoices }) {
    return (
        <Collapsible defaultOpen className="border border-slate-200 rounded-lg bg-white shadow-sm">
            <CollapsibleTrigger className="w-full">
                <CardHeader className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-slate-500" />
                        <CardTitle className="text-base font-semibold text-slate-800">Quotes & Invoices</CardTitle>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Quotes */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-slate-700">Quotes</h4>
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                    <Plus className="w-3 h-3 mr-1" /> New Quote
                                </Button>
                            </div>
                            {quotes.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No quotes created</p>
                            ) : (
                                <div className="space-y-2">
                                    {quotes.map(quote => (
                                        <div key={quote.id} className="p-3 rounded border border-slate-100 bg-slate-50 flex justify-between items-center">
                                            <div>
                                                <div className="font-medium text-sm text-slate-900">{quote.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {quote.value?.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })} • {quote.status}
                                                </div>
                                            </div>
                                            {quote.pandadoc_public_url && (
                                                <a href={quote.pandadoc_public_url} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                        <ExternalLink className="w-4 h-4 text-slate-400" />
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Invoices */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-slate-700">Invoices</h4>
                                {/* Invoice creation often tied to jobs or bulk, maybe link to financials tab? */}
                            </div>
                            {invoices.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No invoices found</p>
                            ) : (
                                <div className="space-y-2">
                                    {invoices.map(invoice => (
                                        <div key={invoice.id} className="p-3 rounded border border-slate-100 bg-slate-50 flex justify-between items-center">
                                            <div>
                                                <div className="font-medium text-sm text-slate-900">{invoice.xero_invoice_number}</div>
                                                <div className="text-xs text-slate-500">
                                                    {invoice.total?.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })} • {invoice.status}
                                                </div>
                                            </div>
                                            {invoice.xero_public_url && (
                                                <a href={invoice.xero_public_url} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                        <ExternalLink className="w-4 h-4 text-slate-400" />
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </CollapsibleContent>
        </Collapsible>
    );
}