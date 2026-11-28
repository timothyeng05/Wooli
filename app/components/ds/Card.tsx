import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "tinted" | "flat";
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Field Notes surface container (16px radius, 4px grid padding, warm hairline border).
 */
export function Card({
  eyebrow,
  title,
  subtitle,
  actions,
  padding = "md",
  variant = "default",
  interactive = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const classes = [
    "ds-card",
    variant === "tinted" ? "ds-card--tinted" : "",
    variant === "flat" ? "ds-card--flat" : "",
    `ds-card--pad-${padding}`,
    interactive ? "ds-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const hasHeader = Boolean(eyebrow || title || subtitle || actions);

  return (
    <div className={classes} {...rest}>
      {hasHeader && (
        <div className="ds-card-header">
          <div style={{ minWidth: 0 }}>
            {eyebrow && <p className="ds-card-eyebrow">{eyebrow}</p>}
            {title && <h3 className="ds-card-title">{title}</h3>}
            {subtitle && <p className="ds-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ds-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
