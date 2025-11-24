import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from "@/api/base44Client";

export default function TakePaymentModal({ 
  open, 
  onClose, 
  onConfirm, 
  isSubmitting,
  invoice
}) {
  const [paymentAmount, setPaymentAmount] = useState(invoice?.amount_due?.toFixed(2) || "0.00");
  const [error, setError] = useState("");
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canMakePayment, setCanMakePayment] = useState(false);
  const [stripePublishableKey, setStripePublishableKey] = useState(null);
  const [prButton, setPrButton] = useState(null);

  useEffect(() => {
    if (open) {
      // Fetch Stripe publishable key and load Stripe.js
      fetchStripeKey();
    }
  }, [open]);

  const fetchStripeKey = async () => {
    try {
      const { data } = await base44.functions.invoke('getStripePublishableKey');
      setStripePublishableKey(data.publishableKey);
      
      // Load Stripe.js
      if (!window.Stripe) {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => {
          setStripeLoaded(true);
          initializeStripe(data.publishableKey);
        };
        document.body.appendChild(script);
      } else {
        setStripeLoaded(true);
        initializeStripe(data.publishableKey);
      }
    } catch (err) {
      console.error('Failed to fetch Stripe key:', err);
      setError('Failed to initialize payment system');
    }
  };

  const initializeStripe = async (publishableKey) => {
    if (!window.Stripe || !publishableKey) {
      console.log('Stripe not ready:', { hasStripe: !!window.Stripe, hasKey: !!publishableKey });
      return;
    }
    
    const stripeInstance = window.Stripe(publishableKey);
    setStripe(stripeInstance);

    // Create Elements instance
    const elementsInstance = stripeInstance.elements();
    setElements(elementsInstance);

    try {
      // Create Payment Request for Apple Pay / Google Pay
      const pr = stripeInstance.paymentRequest({
        country: 'AU',
        currency: 'aud',
        total: {
          label: `Invoice #${invoice?.xero_invoice_number || ''}`,
          amount: Math.round((invoice?.amount_due || 0) * 100)
        },
        requestPayerName: true,
        requestPayerEmail: true
      });

      // Check if Apple Pay or Google Pay is available
      console.log('Checking if wallet payment is available...');
      const result = await pr.canMakePayment();
      console.log('Wallet payment availability:', result);
      
      if (result) {
        setPaymentRequest(pr);
        setCanMakePayment(true);

        // Handle payment from wallet
        pr.on('paymentmethod', async (ev) => {
          try {
            const amount = parseFloat(paymentAmount);
            await onConfirm({
              payment_amount: amount,
              payment_method_id: ev.paymentMethod.id
            });
            ev.complete('success');
            handleClose();
          } catch (err) {
            ev.complete('fail');
            setError(err.message || 'Payment failed');
          }
        });
      } else {
        console.log('Apple Pay/Google Pay not available on this device');
      }
    } catch (err) {
      console.error('Error initializing payment request:', err);
    }
  };

  // Update payment request amount when it changes
  useEffect(() => {
    if (paymentRequest && paymentAmount) {
      const amount = parseFloat(paymentAmount);
      if (!isNaN(amount) && amount > 0) {
        paymentRequest.update({
          total: {
            label: `Invoice #${invoice?.xero_invoice_number || ''}`,
            amount: Math.round(amount * 100)
          }
        });
      }
    }
  }, [paymentAmount, paymentRequest, invoice]);

  const handleConfirm = async () => {
    setError("");

    // Basic validation
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    if (amount > (invoice?.amount_due || 0)) {
      setError("Payment amount cannot exceed the amount due");
      return;
    }

    if (!stripe || !cardElement) {
      setError("Payment system not initialized");
      return;
    }

    try {
      // Create payment method using Card Element
      const { paymentMethod, error: stripeError } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        setError(stripeError.message);
        return;
      }

      // Call backend to process payment
      await onConfirm({
        payment_amount: amount,
        payment_method_id: paymentMethod.id
      });

      // Clear card element
      if (cardElement) {
        cardElement.clear();
      }
      setPaymentAmount("0.00");
    } catch (err) {
      setError(err.message || "Payment failed");
    }
  };

  const handleClose = () => {
    if (cardElement) {
      cardElement.clear();
    }
    setPaymentAmount(invoice?.amount_due?.toFixed(2) || "0.00");
    setError("");
    if (prButton) {
      prButton.unmount();
      setPrButton(null);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border-2 border-[#E5E7EB]">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            Take Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#6B7280]">Invoice</span>
              <span className="font-semibold text-[#111827]">#{invoice?.xero_invoice_number}</span>
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#6B7280]">Amount Due</span>
              <span className="font-bold text-[#111827]">${invoice?.amount_due?.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
              Payment Amount *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">$</span>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </div>

          {canMakePayment && paymentRequest && (
            <div>
              <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-3">
                Quick Pay
              </Label>
              <div 
                id="payment-request-button"
                className="mb-4"
                ref={(el) => {
                  if (el && paymentRequest && stripe && !prButton) {
                    const button = stripe.elements().create('paymentRequestButton', {
                      paymentRequest: paymentRequest,
                    });
                    button.mount(el);
                    setPrButton(button);
                  }
                }}
              />
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#E5E7EB]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-[#6B7280]">Or pay with card</span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[#E5E7EB] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-[#6B7280]" />
              <Label className="text-[13px] md:text-[14px] font-medium text-[#4B5563]">
                Card Details *
              </Label>
            </div>

            <div 
              className="p-3 border border-[#E5E7EB] rounded-lg bg-white"
              ref={(el) => {
                if (el && elements && !cardElement) {
                  const card = elements.create('card', {
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#111827',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        '::placeholder': {
                          color: '#9CA3AF',
                        },
                      },
                      invalid: {
                        color: '#DC2626',
                      },
                    },
                  });
                  card.mount(el);
                  setCardElement(card);
                  
                  card.on('change', (event) => {
                    if (event.error) {
                      setError(event.error.message);
                    } else {
                      setError('');
                    }
                  });
                }
              }}
            />
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-[14px] text-red-700 font-medium">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {!stripeLoaded && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="text-[14px] text-blue-700">
                Loading payment processor...
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-[12px] text-blue-900 leading-relaxed">
              <strong>Secure Payment:</strong> Card details are processed securely through Stripe. 
              Payment will be recorded in Xero automatically.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-[#E5E7EB] hover:bg-[#F3F4F6] rounded-lg font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || !stripeLoaded}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold rounded-lg shadow-sm"
          >
            {isSubmitting ? 'Processing Payment...' : `Process $${paymentAmount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}