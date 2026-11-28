"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

export interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  className?: string;
  children: ReactNode;
}

/**
 * Read-only detail inspector drawer (sticky right rail on desktop, slide-over on <=1020px).
 */
export function InspectorDrawer({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  headerExtra,
  footer,
  width = 380,
  className = "",
  children,
}: InspectorDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const style = {
    "--ds-inspector-width": typeof width === "number" ? `${width}px` : width,
  } as CSSProperties;

  return (
    <>
      <div className="ds-inspector-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className={`ds-inspector-drawer ${className}`.trim()}
        style={style}
        aria-label={typeof title === "string" ? title : "Inspector"}
      >
        <div className="ds-inspector-head">
          <div className="ds-inspector-title-wrap">
            {eyebrow && <p className="ds-inspector-eyebrow">{eyebrow}</p>}
            {title && <h3 className="ds-inspector-title">{title}</h3>}
            {subtitle && <p className="ds-inspector-subtitle">{subtitle}</p>}
          </div>
          <div className="ds-inspector-controls">
            {headerExtra}
            <button
              type="button"
              className="ds-inspector-close"
              onClick={onClose}
              aria-label="Close inspector"
              title="Close (Esc)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="ds-inspector-body">{children}</div>
        {footer && <div className="ds-inspector-footer">{footer}</div>}
      </aside>
    </>
  );
}
