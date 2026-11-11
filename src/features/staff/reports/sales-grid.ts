/** Helpers for the weekday x hour sales grid. */

export type GridCell = { weekday: number; hour: number; orders: number; revenue: string };

/** The cell with the most sales, or null when nothing sold. */
export function busiest(grid: readonly GridCell[]): GridCell | null {
  let best: GridCell | null = null;
  for (const cell of grid) if (!best || Number(cell.revenue) > Number(best.revenue)) best = cell;
  return best && Number(best.revenue) > 0 ? best : null;
}

/** First and last hour with any sales, so the grid skips the closed hours. Default 8-23. */
export function hourSpan(grid: readonly GridCell[]): [number, number] {
  if (grid.length === 0) return [8, 23];
  const hours = grid.map((cell) => cell.hour);
  return [Math.min(...hours), Math.max(...hours)];
}

/** 0 for nothing, then 1-4 by share of the busiest cell. */
export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4)));
}
