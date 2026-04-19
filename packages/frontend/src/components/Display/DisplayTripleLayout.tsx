import { DisplayEditorialTripleLayout } from '@/components/Display/DisplayEditorialTripleLayout';
import { DisplayMineralNoirTripleLayout } from '@/components/Display/DisplayMineralNoirTripleLayout';
import { DisplayModernTripleLayout } from '@/components/Display/DisplayModernTripleLayout';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
import { isEditorialDisplayAppearance, isMineralNoirDisplayAppearance } from '@/config/displayDesignStyles';
import { getTripleZoneStates } from '@/components/Display/displayTripleLayoutUtils';

interface DisplayTripleLayoutProps {
  context: DisplayLayoutContext;
}

export function DisplayTripleLayout({ context }: DisplayTripleLayoutProps) {
  const zoneStates = getTripleZoneStates(context);

  if (isMineralNoirDisplayAppearance(context.displayAppearance)) {
    return <DisplayMineralNoirTripleLayout context={context} zoneStates={zoneStates} />;
  }

  if (isEditorialDisplayAppearance(context.displayAppearance)) {
    return <DisplayEditorialTripleLayout context={context} zoneStates={zoneStates} />;
  }

  // `DisplayModernTripleLayout` is the canonical triple-layout. The
  // previous `DisplayClassicTripleLayout` fallback has been retired —
  // every supported `designStyle` now qualifies as "modern" and every
  // schedule style is covered by the active design pack.
  return <DisplayModernTripleLayout context={context} zoneStates={zoneStates} />;
}
