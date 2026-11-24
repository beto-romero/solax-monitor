import uPlot from "uplot";
import { theme } from "../themes";

const { ink } = theme;

export const SUN = ink.solar;
export const MAINS = ink.grid;
export const EMBER = ink.inverter;
export const HEAT = ink.heat;
export const LILAC = ink.spare;
export const TEXT = ink.text;
export const MUTED = ink.muted;
export const FAINT = ink.faint;
export const HAIRLINE = ink.hairline;
export const GRID = ink.gridline;
export const SURFACE = ink.surface;
export const CROSSES = ink.crosses;

// A series wears its section's colour, so solar reads yellow and grid teal on
// every chart. A second series from the same section on one chart takes a
// spare instead.
export const SECTION_COLOURS: Record<string, string> = { solar: SUN, grid: MAINS, inverter: EMBER };
export const SPARE_COLOURS = [LILAC];

// The canvas is drawn in device pixels while everything here is reckoned in
// CSS pixels. At 180% zoom on a 4K panel, text drawn unscaled came out at a
// little over half its intended size.
export function pixelRatio(): number {
  return uPlot.pxRatio || window.devicePixelRatio || 1;
}

export function colour(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// Axis ticks are reference furniture, not the point of the chart. They grow
// gently with the chart: readable on a big panel without crowding out the
// curve they are labelling.
export function axisTextSize(widthCssPixels: number): number {
  const width = widthCssPixels || 640;
  return Math.round(Math.min(15, Math.max(11, width / 90)));
}

export function axisFont(size: number): string {
  return `${ink.fontStyle} ${size}px ${ink.fontFamily}`.trim();
}

/** The same lettering, a step bolder, for a label that must stand out. */
export function labelFont(size: number): string {
  return `${ink.fontStyle || "600"} ${size}px ${ink.fontFamily}`;
}
