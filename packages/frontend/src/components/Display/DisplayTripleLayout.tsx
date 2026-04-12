import { DisplayClassicTripleLayout } from '@/components/Display/DisplayClassicTripleLayout';
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

  return context.isModernDesign ? (
    <DisplayModernTripleLayout context={context} zoneStates={zoneStates} />
  ) : (
    <DisplayClassicTripleLayout context={context} zoneStates={zoneStates} />
  );
}
