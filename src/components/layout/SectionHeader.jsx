import React from "react";

export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-gray-500 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export default SectionHeader;