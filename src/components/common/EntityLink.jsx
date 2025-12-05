import React from "react";
import { Link } from "react-router-dom";

/**
 * EntityLink ensures:
 * - It renders a real <a> under the hood.
 * - Normal click = client-side navigation.
 * - cmd/ctrl/middle-click = opens in new tab as expected.
 */
export function EntityLink({ to, children, className = "", onClick, ...rest }) {
  // We rely on react-router-dom's Link, which already renders an <a> element
  // and supports cmd/ctrl/middle-click + right-click open in new tab.
  return (
    <Link to={to} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

export default EntityLink;