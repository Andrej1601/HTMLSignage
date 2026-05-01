import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Check,
  Flame,
  Image as ImageIcon,
  Monitor,
  Presentation,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface OnboardingState {
  saunaCount: number;
  scheduleHasEntries: boolean;
  mediaCount: number;
  slideshowHasSlides: boolean;
  pairedDeviceCount: number;
}

interface ChecklistStep {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

function buildSteps(state: OnboardingState): ChecklistStep[] {
  return [
    {
      id: 'saunas',
      icon: Flame,
      title: 'Saunen anlegen',
      description: 'Mindestens eine Sauna ist die Voraussetzung für Aufgüsse.',
      href: '/saunas',
      done: state.saunaCount > 0,
    },
    {
      id: 'schedule',
      icon: CalendarClock,
      title: 'Aufgussplan füllen',
      description: 'Trage Zeiten und Aromen für die Wochenrotation ein.',
      href: '/schedule',
      done: state.scheduleHasEntries,
    },
    {
      id: 'media',
      icon: ImageIcon,
      title: 'Medien hochladen',
      description: 'Bilder und Videos für Slides aus der Mediathek.',
      href: '/media',
      done: state.mediaCount > 0,
    },
    {
      id: 'slideshow',
      icon: Presentation,
      title: 'Slideshow konfigurieren',
      description: 'Lege fest, welche Inhalte das Display rotiert.',
      href: '/slideshow',
      done: state.slideshowHasSlides,
    },
    {
      id: 'devices',
      icon: Monitor,
      title: 'Erstes Display koppeln',
      description: 'Display öffnet `/display`, generiert Code, Code hier eingeben.',
      href: '/devices',
      done: state.pairedDeviceCount > 0,
    },
  ];
}

interface OnboardingChecklistWidgetProps {
  state: OnboardingState;
  /**
   * Wenn `true`, wird das Widget gerendert solange noch nicht alle
   * Schritte abgehakt sind. Auf `false` setzen, sobald der Operator
   * das Widget einmal bewusst geschlossen hat (TODO: per User-Pref
   * persistieren). Default: `true`.
   */
  visible?: boolean;
}

export function OnboardingChecklistWidget({
  state,
  visible = true,
}: OnboardingChecklistWidgetProps) {
  const steps = buildSteps(state);
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  if (!visible || allDone) return null;

  const nextStep = steps.find((s) => !s.done);

  return (
    <section className="rounded-2xl border border-spa-primary/20 bg-spa-primary/5 p-6 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-2 text-spa-text-primary">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-spa-primary/15 text-spa-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold">Erste Schritte</h3>
            <p className="mt-1 text-sm text-spa-text-secondary">
              {nextStep
                ? `Noch ${total - completed} Schritt${total - completed === 1 ? '' : 'e'} bis dein erstes Display live geht.`
                : 'Alle Setup-Schritte abgeschlossen.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-spa-text-primary tabular-nums">
            {completed} / {total}
          </span>
          <div
            className="h-2 w-32 overflow-hidden rounded-full bg-spa-bg-secondary"
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`Onboarding-Fortschritt: ${completed} von ${total}`}
          >
            <div
              className="h-full rounded-full bg-spa-primary transition-all"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isNext = !step.done && step.id === nextStep?.id;
          return (
            <li key={step.id}>
              <Link
                to={step.href}
                className={[
                  'group block h-full rounded-xl border bg-spa-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-xs',
                  step.done
                    ? 'border-spa-success/30 bg-spa-success-light/40'
                    : isNext
                      ? 'border-spa-primary/40 ring-1 ring-spa-primary/20'
                      : 'border-spa-bg-secondary',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={[
                      'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                      step.done
                        ? 'bg-spa-success text-white'
                        : isNext
                          ? 'bg-spa-primary text-white'
                          : 'bg-spa-bg-secondary text-spa-text-secondary',
                    ].join(' ')}
                  >
                    {step.done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <Icon
                    className={[
                      'h-4 w-4',
                      step.done ? 'text-spa-success-dark' : 'text-spa-text-secondary',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-3 text-sm font-semibold text-spa-text-primary">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-spa-text-secondary">
                  {step.description}
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
