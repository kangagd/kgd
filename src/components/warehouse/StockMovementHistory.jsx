import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowRightLeft, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { format } from 'date-fns';

export default function StockMovementHistory() {
  const [search, setSearch] = useState('');

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: () => base44.entities.StockMovement.list('-created_date'),
    staleTime: 30000
  });

  const filteredMovements = movements.filter(m => {
    const query = search.toLowerCase();
    const performerName = m.performed_by_user_name || m.moved_by_name || '';
    return (
      m.item_name?.toLowerCase().includes(query) ||
      m.from_location_name?.toLowerCase().includes(query) ||
      m.to_location_name?.toLowerCase().includes(query) ||
      performerName.toLowerCase().includes(query)
    );
  });

  const getMovementIcon = (source) => {
    // Support both legacy movement_type and new source fields
    const type = source || 'transfer';
    switch (type) {
      case 'transfer':
        return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
      case 'stock_in':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'stock_out':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'adjustment':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'job_usage':
        return <TrendingDown className="w-4 h-4 text-purple-600" />;
      case 'po_receipt':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'manual_adjustment':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'logistics_job_completion':
        return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      default:
        return <ArrowRightLeft className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMovementBadge = (source) => {
    // Support both legacy movement_type and new source fields
    const type = source || 'transfer';
    const badges = {
      transfer: { label: 'Transfer', variant: 'secondary' },
      stock_in: { label: 'Stock In', variant: 'success' },
      stock_out: { label: 'Stock Out', variant: 'destructive' },
      adjustment: { label: 'Adjustment', variant: 'warning' },
      job_usage: { label: 'Job Usage', variant: 'secondary' },
      po_receipt: { label: 'PO Receipt', variant: 'success' },
      manual_adjustment: { label: 'Adjustment', variant: 'warning' },
      logistics_job_completion: { label: 'Logistics', variant: 'secondary' }
    };
    return badges[type] || { label: 'Movement', variant: 'secondary' };
  };

  if (isLoading) {
    return <div className="text-center py-8 text-[#6B7280]">Loading movements...</div>;
  }

  if (movements.length === 0) {
    return <div className="text-center py-8 text-[#6B7280]">No stock movements yet</div>;
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search movements..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-[14px]"
      />

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredMovements.map((movement) => {
          // Support new + legacy field names for backward compatibility
          const source = movement.source || movement.movement_type || 'transfer';
          const performerName = movement.performed_by_user_name || movement.moved_by_name || 'Unknown';
          const performerEmail = movement.performed_by_user_email || movement.moved_by || '';
          const badge = getMovementBadge(source);

          return (
            <Card key={movement.id} className="border-[#E5E7EB]">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {getMovementIcon(source)}

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#111827]">
                      {movement.item_name}
                    </p>

                    <div className="text-[12px] text-[#6B7280] mt-1 space-y-0.5">
                      {(source === 'transfer') && (
                        <p>
                          {movement.from_location_name} → {movement.to_location_name}
                        </p>
                      )}
                      {(source === 'stock_in' || source === 'po_receipt') && (
                        <p>Received to {movement.to_location_name}</p>
                      )}
                      {(source === 'stock_out') && (
                        <p>Deducted from {movement.from_location_name}</p>
                      )}
                      {(source === 'job_usage') && (
                        <p>Used on job from {movement.from_location_name}</p>
                      )}
                      {(source === 'adjustment' || source === 'manual_adjustment') && (
                        <p>Adjusted at {movement.to_location_name}</p>
                      )}
                      {(source === 'logistics_job_completion') && (
                        <p>
                          {movement.from_location_name} → {movement.to_location_name}
                        </p>
                      )}

                      {movement.notes && (
                        <p className="text-[11px] text-[#9CA3AF] italic">
                          {movement.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-[#9CA3AF] mt-2 space-y-0.5">
                      <p>By: {performerName} {performerEmail ? `(${performerEmail})` : ''}</p>
                      <p>{format(new Date(movement.created_date), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-[16px] font-bold text-[#111827]">
                      {movement.quantity}
                    </p>
                    <Badge variant={badge.variant} className="mt-1 text-[10px]">
                      {badge.label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredMovements.length === 0 && (
        <div className="text-center py-8 text-[#6B7280]">
          No movements matching "{search}"
        </div>
      )}
    </div>
  );
}