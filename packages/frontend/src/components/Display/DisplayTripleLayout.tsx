import { DisplayClassicTripleLayout } from '@/components/Display/DisplayClassicTripleLayout';
import { DisplayEditorialTripleLayout } from '@/components/Display/DisplayEditorialTripleLayout';
import { DisplayModernTripleLayout } from '@/components/Display/DisplayModernTripleLayout';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
import { getTripleZoneStates } from '@/components/Display/displayTripleLayoutUtils';

interface DisplayTripleLayoutProps {
  context: DisplayLayoutContext;
}

export function DisplayTripleLayout({ context }: DisplayTripleLayoutProps) {
  const zoneStates = getTripleZoneStates(context);

  if (isEditorialDisplayAppearance(context.displayAppearance)) {
    return <DisplayEditorialTripleLayout context={context} zoneStates={zoneStates} />;
  }

  return context.isModernDesign ? (
    <DisplayModernTripleLayout context={context} zoneStates={zoneStates} />
  ) : (
    <DisplayClassicTripleLayout context={context} zoneStates={zoneStates} />
  );
}
