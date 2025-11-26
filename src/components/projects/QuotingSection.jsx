import React from "react";
import QuotesSection from "../quotes/QuotesSection";

export default function QuotingSection({ project, customer, isAdmin = false }) {
  return (
    <QuotesSection 
      project={project} 
      customer={customer}
      isAdmin={isAdmin}
    />
  );
}