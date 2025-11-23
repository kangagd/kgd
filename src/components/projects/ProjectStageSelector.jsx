import React from "react";
import { Check } from "lucide-react";

const PROJECT_STAGES = [
  "Lead",
  "Initial Site Visit",
  "Quote Sent",
  "Quote Approved",
  "Final Measure",
  "Parts Ordered",
  "Scheduled",
  "Completed"
];

export default function ProjectStageSelector({ currentStage, onStageChange, size = "default" }) {
  const [selectedStage, setSelectedStage] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentIndex = PROJECT_STAGES.indexOf(currentStage);

  const handleStageClick = (stage) => {
    if (stage === currentStage) return;
    setSelectedStage(stage);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (selectedStage && onStageChange) {
      onStageChange(selectedStage);
    }
    setShowConfirm(false);
    setSelectedStage(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setSelectedStage(null);
  };

  const getStageStyle = (stage, index) => {
    if (index === currentIndex) {
      // Current stage - yellow
      return "bg-[#FAE008] text-[#000000] border-[#FAE008] font-bold shadow-sm";
    } else if (index < currentIndex) {
      // Past stages - light grey with checkmark
      return "bg-[#F3F4F6] text-[#111827] border-[#F3F4F6] font-medium";
    } else {
      // Future stages - outline
      return "bg-white text-[#4B5563] border-[#E5E7EB] font-medium";
    }
  };

  const isCompact = size === "compact";

  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {PROJECT_STAGES.map((stage, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <button
              key={stage}
              onClick={() => handleStageClick(stage)}
              disabled={isCurrent}
              className={`
                ${getStageStyle(stage, index)}
                px-2.5 py-1 text-xs whitespace-nowrap
                min-h-[32px]
                rounded-full border transition-all duration-200
                hover:shadow-md hover:scale-105
                active:scale-95
                disabled:cursor-default disabled:hover:scale-100
                flex items-center gap-1 flex-shrink-0
              `}
            >
              {isPast && <Check className="w-3 h-3 flex-shrink-0" />}
              <span className={isCurrent ? 'font-bold' : ''}>{stage}</span>
            </button>
          );
        })}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-2xl border-2 border-[#E5E7EB]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-[#000000]">
              Change Project Stage?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#4B5563]">
              Change project stage to <span className="font-semibold text-[#111827]">{selectedStage}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancel}
              className="rounded-xl font-semibold border-2"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#000000] rounded-xl font-bold shadow-md"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}