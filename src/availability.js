export function isWithinWorkingHours(now = new Date(), cfg) {
  // Hackathon MVP: best-effort availability gate.
  // We don't implement full timezone/day logic yet; we treat server UTC time.
  const hour = now.getUTCHours();
  const start = cfg.workingHours?.startHour ?? 0;
  const end = cfg.workingHours?.endHour ?? 24;
  return hour >= start && hour < end;
}
