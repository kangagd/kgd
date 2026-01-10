import React from "react";

// Fixed color palette
const AVATAR_COLORS = [
  "#F97316", // orange
  "#22C55E", // green
  "#3B82F6", // blue
  "#EC4899", // pink
  "#6366F1", // indigo
  "#F59E0B", // amber
  "#0EA5E9", // sky
  "#A855F7"  // purple
];

// Simple hash function for deterministic color assignment
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Get initials from name
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function TechnicianAvatar({ 
  technician, 
  size = "md", 
  onClick,
  className = ""
}) {
  if (!technician) {
    return null;
  }

  // Determine color based on technician.id or email
  const identifier = technician.id || (technician.email ? technician.email.toLowerCase() : "") || technician.full_name || "";
  const colorIndex = hashString(identifier) % AVATAR_COLORS.length;
  const backgroundColor = AVATAR_COLORS[colorIndex];
  
  const displayName = technician.display_name || "";
  const initials = getInitials(displayName);
  
  // Size variants
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base"
  };
  
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  
  return (
    <div
      onClick={onClick}
      className={`
        ${sizeClass}
        rounded-full 
        flex items-center justify-center 
        text-white font-bold 
        border-2 border-white
        shadow-sm
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{ backgroundColor }}
      title={technician.display_name}
    >
      {initials}
    </div>
  );
}

// Multi-avatar display for multiple technicians
export function TechnicianAvatarGroup({ 
  technicians = [], 
  maxDisplay = 3,
  size = "md",
  onClick
}) {
  if (!technicians || technicians.length === 0) {
    return null;
  }

  const displayTechnicians = technicians.slice(0, maxDisplay);
  const remainingCount = technicians.length - maxDisplay;

  return (
    <div className="flex items-center -space-x-2">
      {displayTechnicians.map((tech, idx) => (
        <TechnicianAvatar
          key={tech.id || tech.email || idx}
          technician={tech}
          size={size}
          onClick={onClick}
        />
      ))}
      {remainingCount > 0 && (
        <div
          className={`
            ${size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm"}
            rounded-full 
            flex items-center justify-center 
            bg-[#6B7280] text-white 
            font-bold 
            border-2 border-white
            shadow-sm
          `}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}