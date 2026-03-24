import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import {
  Home, Calendar, Monitor, Presentation, Image, Flame, Settings, Users,
  Search, CornerDownLeft, ArrowUp, ArrowDown,
} from 'lucide-react';
import clsx from 'clsx';
import { useCommandPaletteContext, type CommandItem } from '@/contexts/CommandPaletteContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: Omit<CommandItem, 'action'>[] = [
  { id: 'nav-dashboard', label: 'Dashboard', description: 'Live-Lage und Betriebsfokus', icon: Home, group: 'Seiten' },
  { id: 'nav-schedule', label: 'Aufgussplan', description: 'Presets und Zeiten', icon: Calendar, group: 'Seiten' },
  { id: 'nav-devices', label: 'Geräte', description: 'Displays und Pairings', icon: Monitor, group: 'Seiten' },
  { id: 'nav-slideshow', label: 'Slideshow', description: 'Slideshows und Varianten', icon: Presentation, group: 'Seiten' },
  { id: 'nav-media', label: 'Medien', description: 'Bilder, Audio und Video', icon: Image, group: 'Seiten' },
  { id: 'nav-saunas', label: 'Saunen', description: 'Saunadaten bearbeiten', icon: Flame, group: 'Seiten' },
  { id: 'nav-settings', label: 'Einstellungen', description: 'Design, Audio, Events', icon: Settings, group: 'Seiten' },
  { id: 'nav-users', label: 'Benutzer', description: 'Rollen und Zugriff', icon: Users, group: 'Seiten' },
];

const ROUTE_MAP: Record<string, string> = {
  'nav-dashboard': '/',
  'nav-schedule': '/schedule',
  'nav-devices': '/devices',
  'nav-slideshow': '/slideshow',
  'nav-media': '/media',
  'nav-saunas': '/saunas',
  'nav-settings': '/settings',
  'nav-users': '/users',
};

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { extraItems } = useCommandPaletteContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo<CommandItem[]>(() => [
    ...NAV_ITEMS.map((item) => ({
      ...item,
      action: () => {
        const route = ROUTE_MAP[item.id];
        if (route) navigate(route);
      },
    })),
    ...extraItems,
  ], [navigate, extraItems]);

  const fuse = useMemo(
    () => new Fuse(items, { keys: ['label', 'description', 'group'], threshold: 0.4 }),
    [items],
  );

  const results = useMemo(() => {
    if (!query.trim()) return items;
    return fuse.search(query).map((r) => r.item);
  }, [query, items, fuse]);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  // Group results
  const grouped = new Map<string, CommandItem[]>();
  for (const item of results) {
    const group = grouped.get(item.group) ?? [];
    group.push(item);
    grouped.set(item.group, group);
  }

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true" aria-label="Command Palette">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-spa-bg-secondary overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-spa-bg-secondary">
          <Search className="h-5 w-5 text-spa-text-secondary flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Seite oder Aktion suchen..."
            className="flex-1 bg-transparent text-spa-text-primary placeholder:text-spa-text-secondary/60 outline-none text-sm"
            aria-label="Suche"
            aria-activedescendant={results[selectedIndex] ? `cmd-${results[selectedIndex].id}` : undefined}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-spa-bg-secondary bg-spa-bg-primary px-1.5 py-0.5 text-[10px] font-medium text-spa-text-secondary">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-spa-text-secondary">
              Keine Ergebnisse für &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([group, groupItems]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary/60">
                  {group}
                </div>
                {groupItems.map((item) => {
                  const thisIndex = flatIndex++;
                  const isSelected = thisIndex === selectedIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      id={`cmd-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-spa-primary/10 text-spa-primary'
                          : 'text-spa-text-primary hover:bg-spa-bg-secondary/60',
                      )}
                      onClick={() => { item.action(); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(thisIndex)}
                    >
                      <Icon className={clsx('h-4 w-4 flex-shrink-0', isSelected ? 'text-spa-primary' : 'text-spa-text-secondary')} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.label}</span>
                        {item.description && (
                          <span className="ml-2 text-xs text-spa-text-secondary">{item.description}</span>
                        )}
                      </div>
                      {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-spa-primary/60" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-spa-bg-secondary px-4 py-2 flex items-center gap-4 text-[11px] text-spa-text-secondary">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> Navigieren
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> Öffnen
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono">ESC</kbd> Schließen
          </span>
        </div>
      </div>
    </div>
  );
}
