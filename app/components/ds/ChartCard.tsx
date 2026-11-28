import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./Badge";
import { Card } from "./Card";
import { Pill } from "./Pill";

export interface ChartLegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

export interface ChartCardProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  metric?: ReactNode;
  delta?: { label: string; tone?: BadgeTone };
  ranges?: readonly string[];
  activeRange?: string;
  onRangeChange?: (range: string) => void;
  legend?: ChartLegendItem[];
  actions?: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Field Notes chart wrapper with tabular KPI metric, range pills, legend, and empty state.
 */
export function ChartCard({
  eyebrow,
  title,
  subtitle,
  metric,
  delta,
  ranges,
  activeRange,
  onRangeChange,
  legend,
  actions,
  empty,
  isEmpty = false,
  footer,
  className = "",
  children,
}: ChartCardProps) {
  return (
    <Card
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      actions={actions}
      className={className}
    >
      {(metric !== undefined || (ranges && ranges.length > 0)) && (
        <div className="ds-chart-top">
          <div className="ds-chart-metric-row">
            {metric !== undefined && <span className="ds-chart-metric">{metric}</span>}
            {delta && <Badge tone={delta.tone ?? "neutral"}>{delta.label}</Badge>}
          </div>
          {ranges && ranges.length > 0 && onRangeChange && (
            <div className="ds-chart-ranges" role="group" aria-label="Time range">
              {ranges.map((r) => (
                <Pill
                  key={r}
                  size="sm"
                  active={activeRange === r}
                  onClick={() => onRangeChange(r)}
                >
                  {r}
                </Pill>
              ))}
            </div>
          )}
        </div>
      )}

      {isEmpty ? (
        <div className="ds-chart-empty">{empty ?? "No data available for this period."}</div>
      ) : (
        <div className="ds-chart-canvas">{children}</div>
      )}

      {legend && legend.length > 0 && (
        <div className="ds-chart-legend">
          {legend.map((item) => (
            <span key={item.label} className="ds-chart-legend-item">
              <span
                className={`ds-chart-legend-swatch${item.dashed ? " is-dashed" : ""}`}
                style={{ backgroundColor: item.dashed ? undefined : item.color, color: item.color }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      )}

      {footer && <div className="ds-chart-footer">{footer}</div>}
    </Card>
  );
}
