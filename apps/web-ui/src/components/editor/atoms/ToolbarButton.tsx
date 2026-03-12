import React from 'react';

export const ToolbarButton = ({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`toolbar-btn ${active ? 'toolbar-btn-active' : ''}`}
  >
    {children}
  </button>
);

export const ToolbarDivider = () => <div className="toolbar-divider" />;
