import React from "react";
import { Check, XCircle } from "lucide-react";
import { PROJECT_STAGES } from "@/domain/projectStages";

export default function ProjectStageSelector({ currentStage, onStageChange, onMarkAsLost, size = "default" }) {
  const isLost = currentStage === "Lost";
  const currentIndex = isLost ? -1 : PROJECT_STAGES.indexOf(currentStage);

  const handleStageClick = (stage) => {
    if (stage === currentStage) return;
    if (onStageChange) {
      onStageChange(stage);
    }
  };

  const getStageStyle = (stage, index) => {
    if (isLost) {
      return "bg-white text-[#9CA3AF] border-[#E5E7EB] font-medium opacity-50";
    }
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
          const isPast = !isLost && index < currentIndex;
          const isCurrent = !isLost && index === currentIndex;
          
          return (
            <button
              key={stage}
              onClick={() => handleStageClick(stage)}
              disabled={isCurrent || isLost}
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
        
        {/* Lost button */}
        <button
          onClick={onMarkAsLost}
          disabled={isLost}
          className={`
            ${isLost 
              ? "bg-red-100 text-red-700 border-red-200 font-bold shadow-sm" 
              : "bg-white text-red-600 border-red-200 font-medium hover:bg-red-50"
            }
            px-2.5 py-1 text-xs whitespace-nowrap
            min-h-[32px]
            rounded-full border transition-all duration-200
            hover:shadow-md hover:scale-105
            active:scale-95
            disabled:cursor-default disabled:hover:scale-100
            flex items-center gap-1 flex-shrink-0 ml-1
          `}
        >
          <XCircle className="w-3 h-3 flex-shrink-0" />
          <span>Lost</span>
        </button>
      </div>
    </>
  );
}