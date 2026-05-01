import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  /** Pausiert den Auto-Dismiss-Timer eines Toasts. Wird beim Hover
   *  oder Fokus aufgerufen — WCAG 2.2.1 verlangt, dass zeitgesteuert
   *  verschwindende Inhalte vom User pausierbar sind. */
  pauseDismiss: (id: string) => void;
  /** Fortsetzen nach Pause: setzt einen neuen Timer mit der Restdauer
   *  (oder voller Default-Dauer, falls Toast bereits sehr alt). */
  resumeDismiss: (id: string) => void;
}

let nextId = 0;

interface ToastTimer {
  timeoutId: ReturnType<typeof setTimeout>;
  /** Zeitpunkt, zu dem dieser Timer gestartet wurde (für Restdauer-Berechnung). */
  startedAt: number;
  /** Verbleibende Dauer beim aktuellen Lauf. */
  remainingMs: number;
}
const timers = new Map<string, ToastTimer>();

function startDismissTimer(
  id: string,
  durationMs: number,
  set: (fn: (s: { toasts: Toast[] }) => Partial<{ toasts: Toast[] }>) => void,
): void {
  const timeoutId = setTimeout(() => {
    timers.delete(id);
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  }, durationMs);
  timers.set(id, { timeoutId, startedAt: Date.now(), remainingMs: durationMs });
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = String(++nextId);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Automatisch entfernen nach Timeout
    const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4000);
    startDismissTimer(id, duration, set);
  },
  removeToast: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timers.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  pauseDismiss: (id) => {
    const timer = timers.get(id);
    if (!timer) return;
    clearTimeout(timer.timeoutId);
    const elapsed = Date.now() - timer.startedAt;
    const remainingMs = Math.max(500, timer.remainingMs - elapsed);
    // Wir lassen den Eintrag im Map mit remainingMs aber ohne aktiven
    // setTimeout — `resumeDismiss` startet ihn dann mit dem Rest neu.
    timers.set(id, {
      timeoutId: 0 as unknown as ReturnType<typeof setTimeout>,
      startedAt: Date.now(),
      remainingMs,
    });
  },
  resumeDismiss: (id) => {
    const timer = timers.get(id);
    if (!timer) return;
    // Falls der Timer noch aktiv ist (z. B. doppelter Resume), nichts tun.
    if (timer.timeoutId && (timer.timeoutId as unknown as number) !== 0) return;
    startDismissTimer(id, timer.remainingMs, set);
  },
}));

// Hilfsfunktionen für bequemen Zugriff
export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ type: 'success', message }),
  error: (message: string) => useToastStore.getState().addToast({ type: 'error', message }),
  warning: (message: string) => useToastStore.getState().addToast({ type: 'warning', message }),
  info: (message: string) => useToastStore.getState().addToast({ type: 'info', message }),
};
