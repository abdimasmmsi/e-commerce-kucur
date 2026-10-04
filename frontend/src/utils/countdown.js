export function formatCountdown(deadline, currentTime = Date.now()) {
  const deadlineTime = new Date(deadline ?? "").getTime();
  if (!Number.isFinite(deadlineTime)) return null;
  const totalSeconds = Math.max(0, Math.ceil((deadlineTime - currentTime) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
