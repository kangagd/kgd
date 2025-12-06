import React from "react";

export function Card({ title, subtitle, className = "", children, headerRight }) {
  return (
    <div className={`card ${className}`}>
      {(title || subtitle || headerRight) && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            {title && (
              <h2 className="section-title">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && (
            <div className="flex items-center gap-2">
              {headerRight}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export default Card;