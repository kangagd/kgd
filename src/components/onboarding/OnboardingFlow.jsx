import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import OnboardingStep from "./OnboardingStep";
import { techSteps } from "./TechOnboarding";
import { officeSteps } from "./OfficeOnboarding";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingFlow({ open, onComplete, userRole }) {
  const isTech = userRole === 'technician';
  const steps = isTech ? techSteps : officeSteps;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await base44.auth.updateMe({ onboarding_completed: true });
      toast.success("Onboarding completed! Welcome aboard!");
      onComplete();
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("Failed to save onboarding progress");
    }
  };

  const handleSkip = async () => {
    if (confirm("Are you sure you want to skip the onboarding tour? You can always access help later.")) {
      await handleComplete();
    }
  };

  const step = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        {showWelcome ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-[#FAE008] rounded-full flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-[#111827]" />
            </div>
            <h1 className="text-3xl font-bold text-[#111827] mb-4">
              Welcome to KangarooGD!
            </h1>
            <p className="text-[#4B5563] text-lg mb-8 max-w-xl">
              {isTech 
                ? "Let's get you started with a quick tour of the essential features you'll use every day as a technician."
                : "Let's walk through the key features of the platform to help you manage projects, schedules, and logistics efficiently."
              }
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="px-6"
              >
                Skip Tour
              </Button>
              <Button
                onClick={() => setShowWelcome(false)}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] px-6"
              >
                Start Tour
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <OnboardingStep
              step={currentStep + 1}
              totalSteps={steps.length}
              title={step.title}
              description={step.description}
              icon={step.icon}
              onNext={handleNext}
              onPrev={handlePrev}
              onSkip={handleSkip}
              isLastStep={currentStep === steps.length - 1}
            >
              {step.content}
            </OnboardingStep>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}