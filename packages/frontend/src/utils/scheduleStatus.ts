// Helper to determine infusion status
const PRE_START_THRESHOLD_MIN = 10;

export type InfusionStatus = 'ongoing' | 'prestart' | 'upcoming' | 'finished';

export function getInfusionStatus(timeStr: string, durationMinutes: number = 60): InfusionStatus {
  const [hours, minutes] = timeStr.split(':').map(Number);

  const now = new Date();
  const startTime = new Date(now);
  startTime.setHours(hours, minutes, 0, 0);

  const preStartTime = new Date(startTime);
  preStartTime.setMinutes(startTime.getMinutes() - PRE_START_THRESHOLD_MIN);

  const endTime = new Date(startTime);
  endTime.setMinutes(startTime.getMinutes() + durationMinutes);

  const currentTime = now.getTime();

  if (currentTime >= startTime.getTime() && currentTime < endTime.getTime()) {
    return 'ongoing';
  }

  if (currentTime >= preStartTime.getTime() && currentTime < startTime.getTime()) {
    return 'prestart';
  }

  if (currentTime < preStartTime.getTime()) {
    return 'upcoming';
  }

  return 'finished';
}

export function getStatusForDisplay(status: InfusionStatus, isNext: boolean): 'ongoing' | 'prestart' | 'next' | null {
  if (status === 'ongoing') return 'ongoing';
  if (status === 'prestart') return 'prestart';
  if (isNext && status === 'upcoming') return 'next';
  return null;
}
