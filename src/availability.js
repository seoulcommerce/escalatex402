export function isWithinWorkingHours(now = new Date(), cfg) {
  const hour = now.getUTCHours();
  const start = cfg.workingHours?.startHour ?? 9;
  const end = cfg.workingHours?.endHour ?? 18;
  // For hackathon MVP assume UTC. (We can add real tz later.)
  return hour >= start && hour < end;
}
