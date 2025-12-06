import React from "react";

export function PageLayout({ title, subtitle, children, actions }) {
  return (
    <div className="page-container">
      <div className="flex items-center justify-between gap-2">
        <div>
          {title && <h1 className="page-title">{title}</h1>}
          {subtitle && (
            <p className="page-subtitle">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export default PageLayout;