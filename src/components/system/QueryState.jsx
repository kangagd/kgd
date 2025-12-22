import React from "react";

/**
 * QueryState - Handles loading, error, and empty states for data queries
 * @param {boolean} isLoading - Loading state
 * @param {Error|string} error - Error object or message
 * @param {boolean} isEmpty - Whether data is empty
 * @param {string} emptyMessage - Message to show when empty
 * @param {React.ReactNode} children - Content to render when data loaded
 */
export default function QueryState({ 
  isLoading, 
  error, 
  isEmpty, 
  emptyMessage = "No data available", 
  children 
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#111827]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-600">
          {typeof error === 'string' ? error : error.message || 'An error occurred'}
        </p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#6B7280]">{emptyMessage}</p>
      </div>
    );
  }

  return children;
}