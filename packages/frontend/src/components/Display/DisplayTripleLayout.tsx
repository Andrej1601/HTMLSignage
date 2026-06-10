import { DisplayModernTripleLayout } from '@/components/Display/DisplayModernTripleLayout';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
import { getTripleZoneStates } from '@/components/Display/displayTripleLayoutUtils';

interface DisplayTripleLayoutProps {
  context: DisplayLayoutContext;
}

export function DisplayTripleLayout({ context }: DisplayTripleLayoutProps) {
  const zoneStates = getTripleZoneStates(context);
  // `DisplayModernTripleLayout` is now the only triple-layout —
  // pack-specific Editorial / Mineral-Noir variants were retired with
  // the rest of the legacy chrome pipeline. Every active design pack
  // renders its own in-slide stage chrome.
  return <DisplayModernTripleLayout context={context} zoneStates={zoneStates} />;
}
