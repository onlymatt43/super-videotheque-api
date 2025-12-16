export const hoursFromNow = (hours: number): Date => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt;
};

export const secondsUntil = (future: Date): number => {
  const diffMs = future.getTime() - Date.now();
  return Math.max(Math.floor(diffMs / 1000), 0);
};
