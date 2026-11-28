import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "brand" | "income" | "expense" | "pending" | "travel";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  dot?: boolean;
  children: ReactNode;
}

/**
 * Semantic status badge (income, expense, pending, travel, brand, neutral).
 */
export function Badge({
  tone = "neutral",
  size = "sm",
  dot = false,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  const classes = ["ds-badge", `ds-badge--${tone}`, `ds-badge--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {dot && <span className="ds-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
