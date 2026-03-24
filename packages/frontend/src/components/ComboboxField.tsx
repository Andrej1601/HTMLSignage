import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import clsx from 'clsx';
import { FieldWrapper } from '@/components/FormField';

interface ComboboxFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
  placeholder?: string;
  allowCreate?: boolean;
  createLabel?: string;
  className?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function ComboboxField({
  value,
  onChange,
  options,
  label,
  placeholder = 'Auswählen...',
  allowCreate = true,
  createLabel = 'Neu erstellen',
  className,
  error,
  hint,
  required,
}: ComboboxFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const showCreateOption = allowCreate && query.trim() && !options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  const totalItems = filtered.length + (showCreateOption ? 1 : 0);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const selectValue = (val: string) => {
    onChange(val);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex < filtered.length) {
          selectValue(filtered[highlightIndex]);
        } else if (showCreateOption) {
          selectValue(query.trim());
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} className={className}>
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : value}
          onChange={(e) => { setQuery(e.target.value); setHighlightIndex(0); if (!isOpen) setIsOpen(true); }}
          onFocus={() => { setIsOpen(true); setQuery(''); }}
          onKeyDown={handleKeyDown}
          placeholder={value || placeholder}
          aria-label={label || placeholder}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
          className="w-full rounded-lg border border-spa-bg-secondary bg-white py-2 pl-3 pr-8 text-sm text-spa-text-primary placeholder:text-spa-text-secondary/60 outline-none focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
        />
        <ChevronDown
          className={clsx(
            'absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-spa-text-secondary transition-transform',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </div>

      {isOpen && totalItems > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-spa-bg-secondary bg-white shadow-lg"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={highlightIndex === i}
              className={clsx(
                'px-3 py-2 text-sm cursor-pointer',
                highlightIndex === i
                  ? 'bg-spa-primary/10 text-spa-primary'
                  : 'text-spa-text-primary hover:bg-spa-bg-secondary/60',
                opt === value && 'font-medium',
              )}
              onClick={() => selectValue(opt)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {opt}
            </li>
          ))}
          {showCreateOption && (
            <li
              role="option"
              aria-selected={highlightIndex === filtered.length}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-t border-spa-bg-secondary',
                highlightIndex === filtered.length
                  ? 'bg-spa-primary/10 text-spa-primary'
                  : 'text-spa-text-secondary hover:bg-spa-bg-secondary/60',
              )}
              onClick={() => selectValue(query.trim())}
              onMouseEnter={() => setHighlightIndex(filtered.length)}
            >
              <Plus className="h-3.5 w-3.5" />
              {createLabel}: &ldquo;{query.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
    </FieldWrapper>
  );
}
