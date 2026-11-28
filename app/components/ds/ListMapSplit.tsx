"use client";

import { useState, type ReactNode } from "react";
import { Pill } from "./Pill";

export interface ListMapSplitProps {
  left: ReactNode;
  right: ReactNode;
  collapsibleMap?: boolean;
  defaultMapCollapsed?: boolean;
  mapToggleLabel?: { show: string; hide: string };
  className?: string;
}

/**
 * Spatial split layout: scrollable left list column + sticky 16px-rounded right map/preview pane.
 */
export function ListMapSplit({
  left,
  right,
  collapsibleMap = true,
  defaultMapCollapsed = false,
  mapToggleLabel = { show: "Show map", hide: "Hide map" },
  className = "",
}: ListMapSplitProps) {
  const [mapCollapsed, setMapCollapsed] = useState(defaultMapCollapsed);

  return (
    <div className={className}>
      {collapsibleMap && (
        <div className="ds-list-map-toggle-row">
          <Pill
            size="sm"
            variant="outline"
            active={!mapCollapsed}
            onClick={() => setMapCollapsed((c) => !c)}
          >
            {mapCollapsed ? mapToggleLabel.show : mapToggleLabel.hide}
          </Pill>
        </div>
      )}
      <div className={`ds-list-map-split${mapCollapsed ? " is-map-collapsed" : ""}`}>
        <div className="ds-list-map-left">{left}</div>
        {!mapCollapsed && <div className="ds-list-map-right">{right}</div>}
      </div>
    </div>
  );
}
