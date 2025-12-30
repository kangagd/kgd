import React, { useState } from "react";
import { MoreHorizontal, LogOut, ArrowRight, Truck, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import CheckoutSampleModal from "./CheckoutSampleModal";
import ReturnSampleModal from "./ReturnSampleModal";
import TransferSampleModal from "./TransferSampleModal";
import MarkLostModal from "./MarkLostModal";

export default function SampleQuickActions({ sample }) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMarkLost, setShowMarkLost] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowCheckout(true)}>
            <LogOut className="w-4 h-4 mr-2" />
            Checkout to Project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowReturn(true)}>
            <ArrowRight className="w-4 h-4 mr-2" />
            Return Sample
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowTransfer(true)}>
            <Truck className="w-4 h-4 mr-2" />
            Transfer to Vehicle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowMarkLost(true)} className="text-red-600">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Mark as Lost
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showCheckout && (
        <CheckoutSampleModal
          sample={sample}
          open={showCheckout}
          onClose={() => setShowCheckout(false)}
        />
      )}

      {showReturn && (
        <ReturnSampleModal
          sample={sample}
          open={showReturn}
          onClose={() => setShowReturn(false)}
        />
      )}

      {showTransfer && (
        <TransferSampleModal
          sample={sample}
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
        />
      )}

      {showMarkLost && (
        <MarkLostModal
          sample={sample}
          open={showMarkLost}
          onClose={() => setShowMarkLost(false)}
        />
      )}
    </>
  );
}