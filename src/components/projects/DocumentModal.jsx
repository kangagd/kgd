import React from "react";
import DocumentViewerModal from "@/components/common/DocumentViewerModal";

export default function DocumentModal({ documentUrl, documentType, onClose, onDelete }) {
  return (
    <DocumentViewerModal
      open={true}
      onClose={onClose}
      url={documentUrl}
      title={documentType}
      onDelete={onDelete}
    />
  );
}