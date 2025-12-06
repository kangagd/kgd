import React from "react";

export function TableShell({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-shell">
        {children}
      </table>
    </div>
  );
}

export default TableShell;