import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

export default function VisitReadinessBadge({ status, className = '' }) {
  if (!status) return null;

  const variants = {
    ready: {
      icon: CheckCircle,
      label: 'Ready',
      class: 'bg-green-100 text-green-700 border-green-300',
    },
    partially_ready: {
      icon: AlertTriangle,
      label: 'Partial',
      class: 'bg-amber-100 text-amber-700 border-amber-300',
    },
    ready_to_pack: {
      icon: AlertTriangle,
      label: 'Pack',
      class: 'bg-blue-100 text-blue-700 border-blue-300',
    },
    ready_to_install: {
      icon: CheckCircle,
      label: 'Install',
      class: 'bg-green-100 text-green-700 border-green-300',
    },
    not_ready: {
      icon: AlertCircle,
      label: 'Not Ready',
      class: 'bg-red-100 text-red-700 border-red-300',
    },
  };

  const variant = variants[status] || variants.not_ready;
  const Icon = variant.icon;

  return (
    <Badge
      className={`flex items-center gap-1 w-fit border ${variant.class} ${className}`}
      variant="outline"
    >
      <Icon className="w-3 h-3" />
      {variant.label}
    </Badge>
  );
}