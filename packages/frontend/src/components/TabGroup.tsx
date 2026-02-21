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
  return (
    <div className="bg-white rounded-lg shadow-sm" role="tablist" aria-label="Reiter">
      <div className="flex border-b border-spa-bg-secondary">
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
              onClick={() => onChange(tab.id)}
              className={clsx(
                'flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2',
                isActive
                  ? 'text-spa-primary border-b-2 border-spa-primary'
                  : 'text-spa-text-secondary hover:text-spa-text-primary',
              )}
            >
              {Icon && <Icon className="w-5 h-5" aria-hidden="true" />}
              {tab.label}
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
    >
      {children}
    </div>
  );
}
