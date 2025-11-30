import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function DuplicateReviewModal({ 
    isOpen, 
    onClose, 
    duplicateCustomer, 
    onMerged, 
    onIgnored 
}) {
    const queryClient = useQueryClient();
    const [selectedPrimaryId, setSelectedPrimaryId] = useState(null);
    const [matches, setMatches] = useState([]);
    const [isLoadingMatches, setIsLoadingMatches] = useState(false);

    // Load matches when modal opens
    React.useEffect(() => {
        if (isOpen && duplicateCustomer) {
            setIsLoadingMatches(true);
            base44.functions.invoke('checkDuplicates', {
                entity_type: 'Customer',
                record: duplicateCustomer,
                exclude_id: duplicateCustomer.id
            })
            .then(res => {
                setMatches(res.data.matches || []);
                if (res.data.matches?.length > 0) {
                    setSelectedPrimaryId(res.data.matches[0].id); // Default select first match
                }
            })
            .finally(() => setIsLoadingMatches(false));
        }
    }, [isOpen, duplicateCustomer]);

    const mergeMutation = useMutation({
        mutationFn: async () => {
            if (!selectedPrimaryId) return;
            await base44.functions.invoke('mergeCustomers', {
                primary_id: selectedPrimaryId,
                duplicate_id: duplicateCustomer.id
            });
        },
        onSuccess: () => {
            toast.success("Customers merged successfully");
            onMerged && onMerged();
            onClose();
        },
        onError: (err) => {
            toast.error("Failed to merge: " + err.message);
        }
    });

    const ignoreMutation = useMutation({
        mutationFn: async () => {
             await base44.entities.Customer.update(duplicateCustomer.id, {
                 is_potential_duplicate: false,
                 merge_status: 'ignored'
             });
        },
        onSuccess: () => {
             toast.success("Duplicate ignored");
             onIgnored && onIgnored();
             onClose();
        }
    });

    if (!duplicateCustomer) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Review Potential Duplicate
                    </DialogTitle>
                    <DialogDescription>
                        The customer <strong>{duplicateCustomer.name}</strong> has been flagged as a potential duplicate.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                         <h4 className="font-semibold text-sm mb-2 text-gray-700">Flagged Customer:</h4>
                         <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-gray-500">Name:</span> {duplicateCustomer.name}</div>
                            <div><span className="text-gray-500">Email:</span> {duplicateCustomer.email || '-'}</div>
                            <div><span className="text-gray-500">Phone:</span> {duplicateCustomer.phone || '-'}</div>
                            <div><span className="text-gray-500">Address:</span> {duplicateCustomer.address || '-'}</div>
                         </div>
                    </div>

                    <h4 className="font-semibold text-sm mb-3 text-gray-700">Potential Matches:</h4>
                    
                    {isLoadingMatches ? (
                        <div className="text-center py-8 text-gray-500">Scanning database...</div>
                    ) : matches.length === 0 ? (
                         <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                            No matches found currently. 
                         </div>
                    ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {matches.map(match => (
                                <div 
                                    key={match.id}
                                    onClick={() => setSelectedPrimaryId(match.id)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                        selectedPrimaryId === match.id 
                                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm flex-1">
                                            <div className="col-span-2 font-medium text-gray-900 flex items-center gap-2">
                                                {match.name}
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                                    {Math.round((match.match_score / 3) * 100)}% Match
                                                </span>
                                            </div>
                                            <div><span className="text-gray-500">Email:</span> {match.email || '-'}</div>
                                            <div><span className="text-gray-500">Phone:</span> {match.phone || '-'}</div>
                                            <div className="col-span-2"><span className="text-gray-500">Address:</span> {match.address_full || '-'}</div>
                                            <div className="col-span-2 mt-1">
                                                <span className="text-xs text-gray-500">Match Reasons: </span>
                                                {match.match_reasons.map(r => (
                                                    <span key={r} className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded mr-1">{r}</span>
                                                ))}
                                            </div>
                                        </div>
                                        {selectedPrimaryId === match.id && (
                                            <CheckCircle2 className="w-5 h-5 text-blue-600 mt-1" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => ignoreMutation.mutate()} disabled={ignoreMutation.isPending || mergeMutation.isPending}>
                        Ignore Duplicate
                    </Button>
                    <Button 
                        onClick={() => mergeMutation.mutate()} 
                        disabled={!selectedPrimaryId || mergeMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {mergeMutation.isPending ? 'Merging...' : (
                            <>
                                Merge into Selected <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}