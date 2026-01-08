import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

/**
 * Reusable delete confirmation dialog with dependency warnings
 */
export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  entityName,
  dependencies = [],
  isDeleting = false
}) {
  const hasDependencies = dependencies.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-2 border-red-200">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-[22px] font-semibold text-[#111827]">
              {title || `Delete ${entityName}?`}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-[14px] text-[#4B5563] mt-4">
            {description || `Are you sure you want to delete this ${entityName?.toLowerCase()}? This action cannot be undone.`}
          </AlertDialogDescription>
          
          {hasDependencies && (
            <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-[13px] font-semibold text-red-900 mb-2">
                ⚠️ Cannot delete - dependencies found:
              </p>
              <ul className="text-[13px] text-red-800 space-y-1 list-disc list-inside">
                {dependencies.map((dep, idx) => (
                  <li key={idx}>{dep}</li>
                ))}
              </ul>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-2 font-semibold">
            Cancel
          </AlertDialogCancel>
          {!hasDependencies && (
            <AlertDialogAction
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}