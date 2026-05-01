import { useEffect, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Strg';

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    entries: [
      { keys: [modKey, 'K'], description: 'Befehlspalette öffnen (Suche + Quick-Actions)' },
      { keys: ['?'], description: 'Diese Übersicht öffnen' },
      { keys: ['Esc'], description: 'Dialog/Palette schließen' },
    ],
  },
  {
    title: 'Editoren',
    entries: [
      { keys: [modKey, 'S'], description: 'Aktuelle Seite speichern (Aufgussplan, Einstellungen, Slideshow, Saunen)' },
      { keys: ['Tab'], description: 'Zum nächsten Feld / Schedule-Zelle' },
      { keys: ['Shift', 'Tab'], description: 'Zum vorherigen Feld' },
      { keys: ['Enter'], description: 'Auswahl / aktivierte Zelle bearbeiten' },
    ],
  },
  {
    title: 'Listen & Tabellen',
    entries: [
      { keys: ['↑', '↓'], description: 'Auswahl in der Befehlspalette' },
      { keys: ['Enter'], description: 'Aktion ausführen' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Tastaturkürzel"
      titleIcon={<Keyboard className="h-5 w-5 text-spa-primary" aria-hidden="true" />}
      size="md"
    >
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-spa-text-secondary mb-2">
              {group.title}
            </h3>
            <ul className="divide-y divide-spa-bg-secondary">
              {group.entries.map((entry, idx) => (
                <li
                  key={`${group.title}-${idx}`}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="text-sm text-spa-text-primary">{entry.description}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {entry.keys.map((k, i) => (
                      <span key={`${k}-${i}`} className="flex items-center gap-1">
                        <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-spa-bg-secondary bg-spa-bg-primary px-1.5 text-[11px] font-semibold text-spa-text-primary">
                          {k}
                        </kbd>
                        {i < entry.keys.length - 1 && (
                          <span className="text-xs text-spa-text-secondary">+</span>
                        )}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/**
 * Globaler `?`-Hotkey, der das Cheatsheet öffnet — ignoriert wenn der
 * Fokus in einem Eingabefeld liegt (sonst frisst es legitime ?-Eingaben).
 */
export function useKeyboardShortcutsDialog(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?') return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
      event.preventDefault();
      setIsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
