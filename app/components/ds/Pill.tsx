import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "default" | "brand" | "soft" | "outline";
  size?: "sm" | "md";
  icon?: ReactNode;
  count?: number | string;
  interactive?: boolean;
  children: ReactNode;
}

/**
 * Capsule pill for filters, range pickers (1W-ALL), and category chips.
 */
export function Pill({
  active = false,
  variant = "default",
  size = "sm",
  icon,
  count,
  interactive = true,
  className = "",
  type = "button",
  children,
  ...rest
}: PillProps) {
  const classes = [
    "ds-pill",
    `ds-pill--${size}`,
    variant !== "default" ? `ds-pill--${variant}` : "",
    active ? "is-active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!interactive) {
    return (
      <span className={classes}>
        {icon}
        <span>{children}</span>
        {count !== undefined && <span className="ds-pill-count">{count}</span>}
      </span>
    );
  }

  return (
    <button type={type} className={classes} aria-pressed={active} {...rest}>
      {icon}
      <span>{children}</span>
      {count !== undefined && <span className="ds-pill-count">{count}</span>}
    </button>
  );
}
