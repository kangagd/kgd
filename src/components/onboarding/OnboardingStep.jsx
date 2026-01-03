import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";

export default function OnboardingStep({ 
  step, 
  totalSteps, 
  title, 
  description, 
  icon: Icon,
  children,
  onNext, 
  onPrev, 
  onSkip,
  isLastStep 
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#6B7280]">Step {step} of {totalSteps}</span>
          <button onClick={onSkip} className="text-sm text-[#6B7280] hover:text-[#111827]">
            Skip tour
          </button>
        </div>
        <div className="w-full bg-[#E5E7EB] rounded-full h-2">
          <div 
            className="bg-[#FAE008] h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          {Icon && (
            <div className="w-12 h-12 bg-[#FAE008]/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-[#111827]" />
            </div>
          )}
          <h2 className="text-2xl font-bold text-[#111827]">{title}</h2>
        </div>
        
        <p className="text-[#4B5563] mb-6">{description}</p>
        
        {children}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-[#E5E7EB] mt-6">
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={step === 1}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        
        <Button
          onClick={onNext}
          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] flex items-center gap-2"
        >
          {isLastStep ? (
            <>
              <Check className="w-4 h-4" />
              Complete
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}