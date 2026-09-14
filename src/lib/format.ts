export function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

const relativeFormat = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function formatRelative(date: Date, now = new Date()) {
  const diffSeconds = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return relativeFormat.format(Math.round(diffSeconds), "second");
  if (abs < 3600) return relativeFormat.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return relativeFormat.format(Math.round(diffSeconds / 3600), "hour");
  return relativeFormat.format(Math.round(diffSeconds / 86400), "day");
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Date as seen by someone living in `timeZone` (e.g. the prospect)
export function formatInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
