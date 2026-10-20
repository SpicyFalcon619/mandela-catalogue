const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03-13" -> "Mar 13, 2026" */
export function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${day}, ${y}`;
}
