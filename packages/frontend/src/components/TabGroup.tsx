import { useRef, useCallback } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export interface Tab<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface TabGroupProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
}

export function TabGroup<T extends string>({ tabs, activeTab, onChange }: TabGroupProps<T>) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab);
      let nextIndex = -1;

      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex >= 0) {
        e.preventDefault();
        onChange(tabs[nextIndex].id);
        // Focus the new tab button
        const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
    },
    [tabs, activeTab, onChange],
  );

  return (
    <div
      className="rounded-2xl border border-spa-bg-secondary/80 bg-spa-surface/95 p-1 shadow-xs backdrop-blur-xs"
      role="tablist"
      aria-label="Reiter"
      ref={tabListRef}
    >
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={handleKeyDown}
              className={clsx(
                'flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 font-medium transition-all',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-inset',
                isActive
                  ? 'bg-spa-primary text-white shadow-xs'
                  : 'text-spa-text-secondary hover:bg-spa-bg-primary hover:text-spa-text-primary',
              )}
            >
              {Icon && <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TabPanelProps<T extends string> {
  id: T;
  activeTab: T;
  children: React.ReactNode;
}

export function TabPanel<T extends string>({ id, activeTab, children }: TabPanelProps<T>) {
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
