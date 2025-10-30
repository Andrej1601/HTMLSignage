import { deepClone, genId } from '../../core/utils.js';
import { DEFAULTS, EVENT_PLAN_ENTRIES, EVENT_PLAN_KEYS } from '../../core/defaults.js';
import { uploadGeneric } from '../../core/upload.js';
import { sanitizePagePlaylist, playlistKeyFromSanitizedEntry, mapSaunaHeadingWidthToInput, SAUNA_HEADING_WIDTH_LIMITS, sanitizeBackgroundAudio } from '../../core/config.js';
import { collectSlideOrderStream, SAUNA_STATUS, SAUNA_STATUS_TEXT } from '../../ui/slides_master.js';

export function createSlidesPanel({ getSettings, thumbFallback, setUnsavedState, resolveOverviewTimeWidthScale }) {
  const renderSlidesBox = () => {
    const settings = getSettings();
    const eventPlanOptions = EVENT_PLAN_ENTRIES.map(([id, label]) => ({ id, label }));
    const allowedEventPlans = new Set(EVENT_PLAN_KEYS || []);
    const f = settings.fonts || {};
    const setV = (sel, val) => { const el = document.querySelector(sel); if (el) el.value = val; };
    const setC = (sel, val) => { const el = document.querySelector(sel); if (el) el.checked = !!val; };
    const ensureDisplaySettings = () => {
      if (!settings.display || typeof settings.display !== 'object') settings.display = {};
      return settings.display;
    };
    const notifySettingsChanged = () => {
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
    };

    const normalizeTime = (value) => {
      if (typeof value !== 'string') return null;
      const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(value);
      if (!match) return null;
      let hour = Number(match[1]);
      let minute = Number(match[2] ?? '0');
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      hour = Math.max(0, Math.min(23, hour));
      minute = Math.max(0, Math.min(59, minute));
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    };

    const normalizeAutomationDateTime = (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      const normalized = trimmed.replace(/\s+/, 'T');
      const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      if (!Number.isFinite(year) || year < 1970 || year > 9999) return null;
      if (!Number.isFinite(month) || month < 1 || month > 12) return null;
      if (!Number.isFinite(day) || day < 1 || day > 31) return null;
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
      if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
      const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour
        .toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const ms = new Date(year, month - 1, day, hour, minute).getTime();
      if (!Number.isFinite(ms)) return null;
      return { iso, ms };
    };

    const formatAutomationDate = (date) => {
      if (!(date instanceof Date)) return '';
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      const h = date.getHours().toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      return `${y.toString().padStart(4, '0')}-${m}-${d}T${h}:${min}`;
    };

    const compareAutomationSlots = (a, b) => {
      const groupA = a.mode === 'range' ? 0 : 1;
      const groupB = b.mode === 'range' ? 0 : 1;
      if (groupA !== groupB) return groupA - groupB;
      if (groupA === 0) {
        return (a.startDateTime || '').localeCompare(b.startDateTime || '');
      }
      return (a.start || '').localeCompare(b.start || '');
    };

    const ensureStyleAutomationState = () => {
      settings.slides ||= {};
      const styleSets = (settings.slides.styleSets && typeof settings.slides.styleSets === 'object') ? settings.slides.styleSets : {};
      const available = Object.keys(styleSets);
      const defaults = DEFAULTS.slides?.styleAutomation || {};
      settings.audio = (settings.audio && typeof settings.audio === 'object') ? settings.audio : {};
      const backgroundDefaults = DEFAULTS.audio?.background || {};
      const backgroundState = sanitizeBackgroundAudio(settings.audio.background, backgroundDefaults);
      settings.audio.background = backgroundState;
      const trackEntries = Object.entries(backgroundState.tracks || {});
      const availableTracks = trackEntries.map(([id]) => id);
      const current = (settings.slides.styleAutomation && typeof settings.slides.styleAutomation === 'object')
        ? deepClone(settings.slides.styleAutomation)
        : {};

      const normalized = {
        enabled: current.enabled !== false,
        fallbackStyle: '',
        fallbackTrack: '',
        timeSlots: []
      };

      const fallbackCandidate = current.fallbackStyle || defaults.fallbackStyle || settings.slides.activeStyleSet || available[0] || '';
      normalized.fallbackStyle = available.includes(fallbackCandidate) ? fallbackCandidate : (available[0] || '');

      const fallbackTrackCandidates = [current.fallbackTrack, defaults.fallbackTrack, backgroundState.activeTrack];
      for (const candidate of fallbackTrackCandidates) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed && availableTracks.includes(trimmed)) {
            normalized.fallbackTrack = trimmed;
            break;
          }
        }
      }
      if (!normalized.fallbackTrack && availableTracks.length) {
        normalized.fallbackTrack = availableTracks[0];
      }

      const slotSource = Array.isArray(current.timeSlots) && current.timeSlots.length
        ? current.timeSlots
        : (Array.isArray(defaults.timeSlots) ? deepClone(defaults.timeSlots) : []);

      const seen = new Set();
      const pushSlot = (slot) => {
        if (!slot || typeof slot !== 'object') return;
        let id = slot.id ? String(slot.id).trim() : '';
        if (!id) id = genId('sty_');
        if (seen.has(id)) return;
        const label = typeof slot.label === 'string' ? slot.label.trim() : '';
        const style = available.includes(slot.style) ? slot.style : normalized.fallbackStyle;
        const trackCandidate = typeof slot.track === 'string' ? slot.track.trim() : '';
        const track = trackCandidate && availableTracks.includes(trackCandidate)
          ? trackCandidate
          : (normalized.fallbackTrack || '');
        const planCandidate = typeof slot.plan === 'string' ? slot.plan.trim() : '';
        const plan = allowedEventPlans.has(planCandidate) ? planCandidate : '';
        const mode = slot.mode === 'range' || (slot.startDateTime && slot.endDateTime)
          ? 'range'
          : 'daily';
        if (mode === 'range') {
          const startInfo = normalizeAutomationDateTime(slot.startDateTime || slot.startDate || slot.start);
          const endInfo = normalizeAutomationDateTime(slot.endDateTime || slot.endDate || slot.end);
          if (!startInfo || !endInfo || endInfo.ms < startInfo.ms) return;
          normalized.timeSlots.push({
            id,
            label,
            style,
            mode: 'range',
            startDateTime: startInfo.iso,
            endDateTime: endInfo.iso,
            track,
            plan
          });
        } else {
          const start = normalizeTime(slot.start || slot.startTime || '');
          if (!start) return;
          normalized.timeSlots.push({ id, label, start, style, mode: 'daily', track, plan });
        }
        seen.add(id);
      };

      slotSource.forEach(pushSlot);

      if (!normalized.timeSlots.length && Array.isArray(defaults.timeSlots)) {
        defaults.timeSlots.forEach(pushSlot);
      }

      normalized.timeSlots.sort(compareAutomationSlots);
      settings.slides.styleAutomation = normalized;
      return normalized;
    };

    const ensureExtrasState = () => {
      const defaults = DEFAULTS.extras || {};
      const extras = settings.extras = (settings.extras && typeof settings.extras === 'object') ? settings.extras : {};

      const toDwellSeconds = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return null;
        return Math.max(1, Math.round(num));
      };

      const sanitizeList = (list, fallback, mapper) => {
        const source = Array.isArray(list) && list.length ? list : (Array.isArray(fallback) ? deepClone(fallback) : []);
        const normalized = [];
        const seen = new Set();
        source.forEach((entry) => {
          if (!entry || typeof entry !== 'object') return;
          const mapped = mapper(entry);
          if (!mapped) return;
          let id = mapped.id ? String(mapped.id).trim() : '';
          if (!id) id = genId('ext_');
          if (seen.has(id)) return;
          mapped.id = id;
          normalized.push(mapped);
          seen.add(id);
        });
        return normalized;
      };

      extras.wellnessTips = sanitizeList(extras.wellnessTips, defaults.wellnessTips, (entry) => {
        const dwell = toDwellSeconds(entry.dwellSec);
        const enabled = entry.enabled !== false;
        const result = {
          id: entry.id,
          icon: typeof entry.icon === 'string' ? entry.icon.trim() : '',
          title: typeof entry.title === 'string' ? entry.title.trim() : '',
          text: typeof entry.text === 'string' ? entry.text.trim() : '',
          enabled
        };
        if (dwell != null) result.dwellSec = dwell;
        return result;
      });

      extras.eventCountdowns = sanitizeList(extras.eventCountdowns, defaults.eventCountdowns, (entry) => {
        const target = typeof entry.target === 'string' ? entry.target.trim() : '';
        const dwell = toDwellSeconds(entry.dwellSec);
        const result = {
          id: entry.id,
          title: typeof entry.title === 'string' ? entry.title.trim() : '',
          subtitle: typeof entry.subtitle === 'string' ? entry.subtitle.trim() : '',
          target,
          style: typeof entry.style === 'string' ? entry.style.trim() : '',
          image: typeof entry.image === 'string' ? entry.image.trim() : '',
          imageThumb: typeof entry.imageThumb === 'string' ? entry.imageThumb.trim() : ''
        };
        if (dwell != null) result.dwellSec = dwell;
        return result;
      });

      extras.infoModules = sanitizeList(extras.infoModules, defaults.infoModules, (entry) => {
        const result = {
          id: entry.id,
          icon: typeof entry.icon === 'string' ? entry.icon.trim() : '',
          text: typeof entry.text === 'string' ? entry.text.trim() : '',
          enabled: entry.enabled !== false
        };
        return result;
      });

      return extras;
    };

    const renderStyleAutomationControls = () => {
      const automation = ensureStyleAutomationState();
      const styleSets = (settings.slides?.styleSets && typeof settings.slides.styleSets === 'object') ? settings.slides.styleSets : {};
      const styleOptions = Object.entries(styleSets).map(([id, value]) => ({ id, label: value?.label || id }));
      const backgroundState = (settings.audio?.background && typeof settings.audio.background === 'object')
        ? settings.audio.background
        : { tracks: {} };
      const trackOptions = Object.entries(backgroundState.tracks || {}).map(([id, value]) => ({
        id,
        label: (typeof value?.label === 'string' && value.label.trim()) ? value.label.trim() : id
      }));

      const enabledInput = document.getElementById('styleAutoEnabled');
      if (enabledInput) {
        enabledInput.checked = automation.enabled !== false;
        enabledInput.onchange = () => {
          automation.enabled = !!enabledInput.checked;
          notifySettingsChanged();
        };
      }

      const fallbackSelect = document.getElementById('styleAutoFallback');
      if (fallbackSelect) {
        fallbackSelect.innerHTML = '';
        styleOptions.forEach(({ id, label }) => {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = label;
          fallbackSelect.appendChild(opt);
        });
        if (!automation.fallbackStyle && styleOptions.length) {
          automation.fallbackStyle = styleOptions[0].id;
        }
        if (automation.fallbackStyle && !styleOptions.some(opt => opt.id === automation.fallbackStyle) && styleOptions.length) {
          automation.fallbackStyle = styleOptions[0].id;
        }
        if (automation.fallbackStyle) fallbackSelect.value = automation.fallbackStyle;
        fallbackSelect.onchange = () => {
          automation.fallbackStyle = fallbackSelect.value || '';
          automation.timeSlots.forEach(slot => {
            if (!styleOptions.some(opt => opt.id === slot.style)) {
              slot.style = automation.fallbackStyle;
            }
          });
          renderStyleAutomationControls();
          notifySettingsChanged();
        };
      }

      const fallbackTrackSelect = document.getElementById('styleAutoFallbackTrack');
      if (fallbackTrackSelect) {
        fallbackTrackSelect.innerHTML = '';
        if (!trackOptions.length) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'Keine Musik-Presets verfügbar';
          fallbackTrackSelect.appendChild(opt);
          fallbackTrackSelect.disabled = true;
          automation.fallbackTrack = '';
        } else {
          fallbackTrackSelect.disabled = false;
          const activeTrackId = typeof backgroundState.activeTrack === 'string'
            ? backgroundState.activeTrack
            : '';
          const activeTrackOption = trackOptions.find((opt) => opt.id === activeTrackId) || null;
          const resolveDefaultFallback = () =>
            (activeTrackOption ? activeTrackOption.id : (trackOptions[0]?.id || ''));
          trackOptions.forEach(({ id, label }) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = label;
            fallbackTrackSelect.appendChild(opt);
          });
          if (!automation.fallbackTrack || !trackOptions.some(opt => opt.id === automation.fallbackTrack)) {
            automation.fallbackTrack = resolveDefaultFallback();
          }
          const selectedFallback = trackOptions.some(opt => opt.id === automation.fallbackTrack)
            ? automation.fallbackTrack
            : resolveDefaultFallback();
          automation.fallbackTrack = selectedFallback;
          fallbackTrackSelect.value = selectedFallback;
        }
        fallbackTrackSelect.onchange = () => {
          const next = fallbackTrackSelect.value || '';
          automation.fallbackTrack = next;
          automation.timeSlots.forEach(slot => {
            if (!trackOptions.some(opt => opt.id === slot.track)) {
              slot.track = next;
            }
          });
          renderStyleAutomationControls();
          notifySettingsChanged();
        };
      }

      const listHost = document.getElementById('styleAutoList');
      if (listHost) {
        listHost.innerHTML = '';
        automation.timeSlots.sort(compareAutomationSlots);
        automation.timeSlots.forEach((slot, index) => {
          const row = document.createElement('div');
          row.className = 'style-auto-slot';

          if (!allowedEventPlans.has(slot.plan)) {
            slot.plan = '';
          }

          const modeWrap = document.createElement('div');
          modeWrap.className = 'style-auto-field style-auto-mode';
          const modeLabel = document.createElement('label');
          modeLabel.textContent = 'Typ';
          const modeSelect = document.createElement('select');
          modeSelect.className = 'input';
          [
            { value: 'daily', label: 'Täglich' },
            { value: 'range', label: 'Zeitraum' }
          ].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            modeSelect.appendChild(opt);
          });
          modeSelect.value = slot.mode === 'range' ? 'range' : 'daily';
          modeSelect.onchange = () => {
            const nextMode = modeSelect.value === 'range' ? 'range' : 'daily';
            if (nextMode === slot.mode) return;
            if (nextMode === 'range') {
              const now = new Date();
              const startDefault = formatAutomationDate(now);
              const endDefault = formatAutomationDate(new Date(now.getTime() + 60 * 60 * 1000));
              slot.mode = 'range';
              slot.startDateTime = normalizeAutomationDateTime(slot.startDateTime)?.iso
                || normalizeAutomationDateTime(slot.start)?.iso
                || startDefault;
              slot.endDateTime = normalizeAutomationDateTime(slot.endDateTime)?.iso || endDefault;
              delete slot.start;
            } else {
              const start = normalizeTime(slot.start) || normalizeTime('06:00') || '06:00';
              slot.mode = 'daily';
              slot.start = start || '06:00';
              delete slot.startDateTime;
              delete slot.endDateTime;
            }
            automation.timeSlots.sort(compareAutomationSlots);
            renderStyleAutomationControls();
            notifySettingsChanged();
          };
          modeWrap.append(modeLabel, modeSelect);
          row.appendChild(modeWrap);

          if (slot.mode === 'range') {
            const startWrap = document.createElement('div');
            startWrap.className = 'style-auto-field';
            const startLabel = document.createElement('label');
            startLabel.textContent = 'Start (Datum & Uhrzeit)';
            const startInput = document.createElement('input');
            startInput.type = 'datetime-local';
            startInput.value = slot.startDateTime || '';
            startInput.onchange = () => {
              const next = normalizeAutomationDateTime(startInput.value);
              if (!next) {
                startInput.value = slot.startDateTime || '';
                return;
              }
              slot.startDateTime = next.iso;
              const endInfo = normalizeAutomationDateTime(slot.endDateTime);
              if (endInfo && endInfo.ms < next.ms) {
                const adjusted = new Date(next.ms + 60 * 60 * 1000);
                slot.endDateTime = formatAutomationDate(adjusted);
              }
              automation.timeSlots.sort(compareAutomationSlots);
              renderStyleAutomationControls();
              notifySettingsChanged();
            };
            startWrap.append(startLabel, startInput);

            const endWrap = document.createElement('div');
            endWrap.className = 'style-auto-field';
            const endLabel = document.createElement('label');
            endLabel.textContent = 'Ende (Datum & Uhrzeit)';
            const endInput = document.createElement('input');
            endInput.type = 'datetime-local';
            endInput.value = slot.endDateTime || '';
            endInput.onchange = () => {
              const next = normalizeAutomationDateTime(endInput.value);
              const startInfo = normalizeAutomationDateTime(slot.startDateTime);
              if (!next || (startInfo && next.ms < startInfo.ms)) {
                endInput.value = slot.endDateTime || '';
                return;
              }
              slot.endDateTime = next.iso;
              automation.timeSlots.sort(compareAutomationSlots);
              renderStyleAutomationControls();
              notifySettingsChanged();
            };
            endWrap.append(endLabel, endInput);

            row.append(startWrap, endWrap);
          } else {
            const timeWrap = document.createElement('div');
            timeWrap.className = 'style-auto-field';
            const timeLabel = document.createElement('label');
            timeLabel.textContent = 'Startzeit';
            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.value = slot.start || '06:00';
            timeInput.onchange = () => {
              const next = normalizeTime(timeInput.value);
              if (!next) {
                timeInput.value = slot.start || '06:00';
                return;
              }
              slot.start = next;
              automation.timeSlots.sort(compareAutomationSlots);
              renderStyleAutomationControls();
              notifySettingsChanged();
            };
            timeWrap.append(timeLabel, timeInput);
            row.appendChild(timeWrap);
          }

          const styleWrap = document.createElement('div');
          styleWrap.className = 'style-auto-field';
          const styleLabel = document.createElement('label');
          styleLabel.textContent = 'Stil';
          const styleSelect = document.createElement('select');
          styleSelect.className = 'input';
          styleOptions.forEach(({ id, label }) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = label;
            styleSelect.appendChild(opt);
          });
          if (slot.style && styleOptions.some(opt => opt.id === slot.style)) {
            styleSelect.value = slot.style;
          } else if (automation.fallbackStyle) {
            slot.style = automation.fallbackStyle;
            styleSelect.value = automation.fallbackStyle;
          }
          styleSelect.onchange = () => {
            slot.style = styleSelect.value || automation.fallbackStyle;
            notifySettingsChanged();
          };
          styleWrap.append(styleLabel, styleSelect);
          row.appendChild(styleWrap);

          const trackWrap = document.createElement('div');
          trackWrap.className = 'style-auto-field';
          const trackLabel = document.createElement('label');
          trackLabel.textContent = 'Musik';
          const trackSelect = document.createElement('select');
          trackSelect.className = 'input';
          if (!trackOptions.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Keine Presets';
            trackSelect.appendChild(opt);
            trackSelect.disabled = true;
            slot.track = '';
          } else {
            trackOptions.forEach(({ id, label }) => {
              const opt = document.createElement('option');
              opt.value = id;
              opt.textContent = label;
              trackSelect.appendChild(opt);
            });
            if (slot.track && trackOptions.some(opt => opt.id === slot.track)) {
              trackSelect.value = slot.track;
            } else {
              slot.track = automation.fallbackTrack || trackOptions[0].id;
              trackSelect.value = slot.track;
            }
          }
          trackSelect.onchange = () => {
            slot.track = trackSelect.value || automation.fallbackTrack || '';
            notifySettingsChanged();
          };
          trackWrap.append(trackLabel, trackSelect);
          row.appendChild(trackWrap);

          const planWrap = document.createElement('div');
          planWrap.className = 'style-auto-field';
          const planLabel = document.createElement('label');
          planLabel.textContent = 'Plan';
          const planSelect = document.createElement('select');
          planSelect.className = 'input';
          const defaultPlanOpt = document.createElement('option');
          defaultPlanOpt.value = '';
          defaultPlanOpt.textContent = 'Standard (Wochentag)';
          planSelect.appendChild(defaultPlanOpt);
          eventPlanOptions.forEach(({ id, label }) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = label;
            planSelect.appendChild(opt);
          });
          const currentPlan = allowedEventPlans.has(slot.plan) ? slot.plan : '';
          slot.plan = currentPlan;
          planSelect.value = currentPlan;
          planSelect.onchange = () => {
            const next = planSelect.value || '';
            slot.plan = allowedEventPlans.has(next) ? next : '';
            notifySettingsChanged();
          };
          planWrap.append(planLabel, planSelect);
          row.appendChild(planWrap);

          const labelWrap = document.createElement('div');
          labelWrap.className = 'style-auto-field';
          const labelLabel = document.createElement('label');
          labelLabel.textContent = 'Label';
          const labelInput = document.createElement('input');
          labelInput.className = 'input';
          labelInput.placeholder = 'z. B. Abend';
          labelInput.value = slot.label || '';
          labelInput.oninput = () => {
            slot.label = labelInput.value.trim();
            notifySettingsChanged();
          };
          labelWrap.append(labelLabel, labelInput);
          row.appendChild(labelWrap);

          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn sm ghost';
          removeBtn.type = 'button';
          removeBtn.textContent = 'Entfernen';
          removeBtn.onclick = () => {
            automation.timeSlots.splice(index, 1);
            renderStyleAutomationControls();
            notifySettingsChanged();
          };
          row.appendChild(removeBtn);

          listHost.appendChild(row);
        });
      }

      const addBtn = document.getElementById('styleAutoAdd');
      if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = '1';
        addBtn.addEventListener('click', () => {
          const state = ensureStyleAutomationState();
          const last = state.timeSlots[state.timeSlots.length - 1];
          const start = last && last.mode === 'daily' ? last.start : '06:00';
          state.timeSlots.push({
            id: genId('sty_'),
            mode: 'daily',
            start: start || '06:00',
            label: '',
            style: state.fallbackStyle,
            track: state.fallbackTrack,
            plan: ''
          });
          state.timeSlots.sort(compareAutomationSlots);
          renderStyleAutomationControls();
          notifySettingsChanged();
        });
      }
    };

    const toDatetimeLocal = (value) => {
      if (!value) return '';
      const trimmed = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return trimmed;
      const date = new Date(trimmed);
      if (!Number.isFinite(date.getTime())) return '';
      return formatAutomationDate(date);
    };

    const fromDatetimeLocal = (value) => {
      if (typeof value !== 'string') return '';
      return value.trim();
    };

    const renderExtrasEditor = () => {
      const extras = ensureExtrasState();
      const styleSets = (settings.slides?.styleSets && typeof settings.slides.styleSets === 'object') ? settings.slides.styleSets : {};
      const styleOptions = Object.entries(styleSets).map(([id, value]) => ({ id, label: value?.label || id }));

      const wellnessHost = document.getElementById('extrasWellnessList');
      if (wellnessHost) {
        wellnessHost.innerHTML = '';
        extras.wellnessTips.forEach((tip, index) => {
          const row = document.createElement('div');
          row.className = 'extras-item';

          const header = document.createElement('div');
          header.className = 'extras-item-header extras-inline';

          const iconInput = document.createElement('input');
          iconInput.className = 'input';
          iconInput.placeholder = 'Emoji/Icon';
          iconInput.maxLength = 6;
          iconInput.value = tip.icon || '';
          iconInput.oninput = () => {
            tip.icon = iconInput.value.trim();
            notifySettingsChanged();
          };

          const titleInput = document.createElement('input');
          titleInput.className = 'input';
          titleInput.placeholder = 'Titel';
          titleInput.value = tip.title || '';
          titleInput.oninput = () => {
            tip.title = titleInput.value.trim();
            notifySettingsChanged();
          };

          const enabledToggle = document.createElement('label');
          enabledToggle.className = 'toggle extras-toggle';
          const enabledInput = document.createElement('input');
          enabledInput.type = 'checkbox';
          const enabledText = document.createElement('span');
          enabledText.className = 'extras-toggle-label';
          enabledToggle.append(enabledInput, enabledText);

          const applyEnabledState = (shouldNotify = false) => {
            const active = !!enabledInput.checked;
            tip.enabled = active;
            enabledText.textContent = active ? 'Aktiv' : 'Ausgeblendet';
            row.classList.toggle('is-disabled', !active);
            if (shouldNotify) notifySettingsChanged();
          };

          enabledInput.addEventListener('change', () => applyEnabledState(true));
          enabledInput.checked = tip.enabled !== false;
          applyEnabledState(false);

          header.append(iconInput, titleInput, enabledToggle);

          const body = document.createElement('div');
          body.className = 'extras-item-body';
          const textArea = document.createElement('textarea');
          textArea.className = 'input';
          textArea.placeholder = 'Beschreibung oder Tipptext';
          textArea.value = tip.text || '';
          textArea.oninput = () => {
            tip.text = textArea.value.trim();
            notifySettingsChanged();
          };
          body.appendChild(textArea);

          const dwellRow = document.createElement('div');
          dwellRow.className = 'extras-inline';
          const dwellLabel = document.createElement('label');
          dwellLabel.textContent = 'Anzeige (Sek.)';
          const dwellInput = document.createElement('input');
          dwellInput.className = 'input num3';
          dwellInput.type = 'number';
          dwellInput.min = '1';
          dwellInput.max = '600';
          dwellInput.placeholder = 'Standard';
          dwellInput.value = tip.dwellSec != null ? String(tip.dwellSec) : '';
          dwellInput.onchange = () => {
            const num = Number(dwellInput.value);
            if (Number.isFinite(num) && num > 0) {
              tip.dwellSec = Math.max(1, Math.round(num));
            } else {
              delete tip.dwellSec;
              dwellInput.value = '';
            }
            notifySettingsChanged();
          };
          dwellRow.append(dwellLabel, dwellInput);
          body.appendChild(dwellRow);

          const actions = document.createElement('div');
          actions.className = 'extras-item-actions';
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn sm ghost';
          removeBtn.type = 'button';
          removeBtn.textContent = 'Entfernen';
          removeBtn.onclick = () => {
            extras.wellnessTips.splice(index, 1);
            renderExtrasEditor();
            notifySettingsChanged();
          };
          actions.appendChild(removeBtn);

          row.append(header, body, actions);
          wellnessHost.appendChild(row);
        });
      }

      const addWellness = document.getElementById('extrasWellnessAdd');
      if (addWellness && !addWellness.dataset.bound) {
        addWellness.dataset.bound = '1';
        addWellness.addEventListener('click', () => {
          extras.wellnessTips.push({ id: genId('well_'), icon: '', title: '', text: '', dwellSec: null, enabled: true });
          renderExtrasEditor();
          notifySettingsChanged();
        });
      }

      const eventHost = document.getElementById('extrasEventList');
      if (eventHost) {
        eventHost.innerHTML = '';
        extras.eventCountdowns.forEach((event, index) => {
          const row = document.createElement('div');
          row.className = 'extras-item';

          const header = document.createElement('div');
          header.className = 'extras-item-header extras-inline';

          const titleInput = document.createElement('input');
          titleInput.className = 'input';
          titleInput.placeholder = 'Eventtitel';
          titleInput.value = event.title || '';
          titleInput.oninput = () => {
            event.title = titleInput.value.trim();
            notifySettingsChanged();
          };

          const subtitleInput = document.createElement('input');
          subtitleInput.className = 'input';
          subtitleInput.placeholder = 'Infos zum Event (optional)';
          subtitleInput.value = event.subtitle || '';
          subtitleInput.oninput = () => {
            event.subtitle = subtitleInput.value.trim();
            notifySettingsChanged();
          };

          header.append(titleInput, subtitleInput);

          const body = document.createElement('div');
          body.className = 'extras-item-body';

          const timeRow = document.createElement('div');
          timeRow.className = 'extras-inline';
          const timeInput = document.createElement('input');
          timeInput.type = 'datetime-local';
          timeInput.className = 'input';
          timeInput.value = toDatetimeLocal(event.target);
          timeInput.onchange = () => {
            event.target = fromDatetimeLocal(timeInput.value);
            notifySettingsChanged();
          };

          const styleSelect = document.createElement('select');
          styleSelect.className = 'input';
          const baseOpt = document.createElement('option');
          baseOpt.value = '';
          baseOpt.textContent = 'Style-Automation folgen';
          styleSelect.appendChild(baseOpt);
          styleOptions.forEach(({ id, label }) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = label;
            styleSelect.appendChild(opt);
          });
          if (event.style && styleOptions.some(opt => opt.id === event.style)) {
            styleSelect.value = event.style;
          }
          styleSelect.onchange = () => {
            event.style = styleSelect.value || '';
            notifySettingsChanged();
          };

          timeRow.append(timeInput, styleSelect);
          body.append(timeRow);

          const mediaRow = document.createElement('div');
          mediaRow.className = 'extras-inline extras-media-row';
          const thumbImg = document.createElement('img');
          thumbImg.className = 'extras-thumb';
          thumbImg.alt = 'Event-Vorschau';
          const updateThumb = () => {
            const src = event.imageThumb || event.image || thumbFallback;
            thumbImg.src = src || thumbFallback;
            thumbImg.classList.toggle('is-empty', !event.image && !event.imageThumb);
          };
          updateThumb();

          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.style.display = 'none';
          const uploadLabel = document.createElement('label');
          uploadLabel.className = 'btn sm';
          uploadLabel.textContent = 'Bild wählen';
          uploadLabel.appendChild(fileInput);
          fileInput.onchange = () => {
            uploadGeneric(fileInput, (path, thumb) => {
              event.image = path || '';
              event.imageThumb = thumb || path || '';
              updateThumb();
              updateClearState();
              notifySettingsChanged();
            });
          };

          const clearBtn = document.createElement('button');
          clearBtn.className = 'btn sm ghost';
          clearBtn.type = 'button';
          clearBtn.textContent = 'Bild entfernen';
          const updateClearState = () => {
            clearBtn.disabled = !(event.image || event.imageThumb);
          };
          updateClearState();
          clearBtn.onclick = () => {
            event.image = '';
            event.imageThumb = '';
            updateThumb();
            updateClearState();
            notifySettingsChanged();
          };

          mediaRow.append(thumbImg, uploadLabel, clearBtn);
          body.append(mediaRow);

          const actions = document.createElement('div');
          actions.className = 'extras-item-actions';
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn sm ghost';
          removeBtn.type = 'button';
          removeBtn.textContent = 'Entfernen';
          removeBtn.onclick = () => {
            extras.eventCountdowns.splice(index, 1);
            renderExtrasEditor();
            notifySettingsChanged();
          };
          actions.appendChild(removeBtn);

          row.append(header, body, actions);
          eventHost.appendChild(row);
        });
      }

      const addEventBtn = document.getElementById('extrasEventAdd');
      if (addEventBtn && !addEventBtn.dataset.bound) {
        addEventBtn.dataset.bound = '1';
        addEventBtn.addEventListener('click', () => {
          extras.eventCountdowns.push({ id: genId('evt_'), title: '', subtitle: '', target: '', style: '', image: '', imageThumb: '' });
          renderExtrasEditor();
          notifySettingsChanged();
        });
      }

      const infoHost = document.getElementById('extrasInfoModuleList');
      if (infoHost) {
        infoHost.innerHTML = '';
        extras.infoModules.forEach((entry, entryIndex) => {
          const row = document.createElement('div');
          row.className = 'extras-item extras-info-entry';

          const header = document.createElement('div');
          header.className = 'extras-item-header extras-inline';

          const preview = document.createElement('div');
          preview.className = 'extras-info-preview';
          const previewIcon = document.createElement('span');
          previewIcon.className = 'extras-info-preview-icon';
          const previewText = document.createElement('span');
          previewText.className = 'extras-info-preview-text';
          preview.append(previewIcon, previewText);

          const enabledToggle = document.createElement('label');
          enabledToggle.className = 'toggle extras-toggle';
          const enabledInput = document.createElement('input');
          enabledInput.type = 'checkbox';
          const enabledText = document.createElement('span');
          enabledText.className = 'extras-toggle-label';
          enabledToggle.append(enabledInput, enabledText);

          header.append(preview, enabledToggle);
          row.appendChild(header);

          const body = document.createElement('div');
          body.className = 'extras-item-body extras-info-body';

          const iconInput = document.createElement('input');
          iconInput.className = 'input';
          iconInput.placeholder = 'Icon (optional)';
          iconInput.maxLength = 6;
          iconInput.value = entry.icon || '';

          const textArea = document.createElement('textarea');
          textArea.className = 'input';
          textArea.placeholder = 'Hinweistext';
          textArea.rows = 3;
          textArea.value = entry.text || '';

          const applyPreview = () => {
            const icon = typeof entry.icon === 'string' ? entry.icon.trim() : '';
            const text = typeof entry.text === 'string' ? entry.text.trim() : '';
            previewIcon.textContent = icon || '';
            const short = text.length > 60 ? text.slice(0, 57) + '…' : text;
            previewText.textContent = short || 'Neuer Hinweis';
          };

          iconInput.oninput = () => {
            entry.icon = iconInput.value.trim();
            applyPreview();
            notifySettingsChanged();
          };

          textArea.oninput = () => {
            entry.text = textArea.value;
            applyPreview();
            notifySettingsChanged();
          };

          body.append(iconInput, textArea);

          const actions = document.createElement('div');
          actions.className = 'extras-item-actions';
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn sm ghost';
          removeBtn.type = 'button';
          removeBtn.textContent = 'Eintrag entfernen';
          removeBtn.onclick = () => {
            extras.infoModules.splice(entryIndex, 1);
            renderExtrasEditor();
            notifySettingsChanged();
          };
          actions.appendChild(removeBtn);
          body.appendChild(actions);
          row.appendChild(body);

          const applyEnabled = (shouldNotify = false) => {
            const active = !!enabledInput.checked;
            entry.enabled = active;
            enabledText.textContent = active ? 'Aktiv' : 'Ausgeblendet';
            row.classList.toggle('is-disabled', !active);
            if (shouldNotify) notifySettingsChanged();
          };

          enabledInput.checked = entry.enabled !== false;
          enabledInput.addEventListener('change', () => applyEnabled(true));

          applyPreview();
          applyEnabled(false);

          infoHost.appendChild(row);
        });
      }
      const addInfoBtn = document.getElementById('extrasInfoModuleAdd');
      if (addInfoBtn && !addInfoBtn.dataset.bound) {
        addInfoBtn.dataset.bound = '1';
        addInfoBtn.addEventListener('click', () => {
          extras.infoModules.push({ id: genId('info_'), icon: '', text: '', enabled: true });
          renderExtrasEditor();
          notifySettingsChanged();
        });
      }
    };

    const renderHeroTimelineControls = () => {
      const ensureSlides = () => {
        settings.slides ||= {};
        return settings.slides;
      };

      const rerenderPlaylists = () => {
        const displayCfg = settings.display = settings.display || {};
        const pagesCfg = displayCfg.pages = displayCfg.pages || {};
        const leftState = pagesCfg.left = pagesCfg.left || {};
        const rightState = pagesCfg.right = pagesCfg.right || {};
        renderPagePlaylist('pageLeftPlaylist', leftState.playlist, { pageKey: 'left' });
        renderPagePlaylist('pageRightPlaylist', rightState.playlist, { pageKey: 'right' });
      };

      const enabledInput = document.getElementById('heroTimelineEnabled');
      const settingsPanel = document.getElementById('heroTimelineSettings');
      if (enabledInput) {
        const slidesCfg = ensureSlides();
        const enabled = !!slidesCfg.heroEnabled;
        enabledInput.checked = enabled;
        if (settingsPanel) settingsPanel.hidden = !enabled;
        if (!enabledInput.dataset.bound) {
          enabledInput.dataset.bound = '1';
          enabledInput.addEventListener('change', () => {
            const slides = ensureSlides();
            slides.heroEnabled = !!enabledInput.checked;
            if (settingsPanel) settingsPanel.hidden = !enabledInput.checked;
            rerenderPlaylists();
            notifySettingsChanged();
          });
        }
      }

      const durationInput = document.getElementById('heroTimelineDuration');
      if (durationInput) {
        const slidesCfg = ensureSlides();
        const defaultMs = Number(DEFAULTS.slides?.heroTimelineFillMs) || 8000;
        const raw = Number(slidesCfg.heroTimelineFillMs);
        const ms = Number.isFinite(raw) && raw > 0 ? Math.max(1000, Math.round(raw)) : defaultMs;
        durationInput.value = Math.round(ms / 1000);
        if (!durationInput.dataset.bound) {
          durationInput.dataset.bound = '1';
          durationInput.addEventListener('change', () => {
            const slides = ensureSlides();
            const value = Number(durationInput.value);
            if (Number.isFinite(value) && value > 0) {
              const sanitized = Math.max(1, Math.round(value));
              slides.heroTimelineFillMs = sanitized * 1000;
              durationInput.value = String(sanitized);
            } else {
              delete slides.heroTimelineFillMs;
              durationInput.value = String(Math.round((Number(DEFAULTS.slides?.heroTimelineFillMs) || 8000) / 1000));
            }
            notifySettingsChanged();
          });
        }
      }

      const maxInput = document.getElementById('heroTimelineMax');
      if (maxInput) {
        const slidesCfg = ensureSlides();
        const raw = slidesCfg.heroTimelineMaxEntries;
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          const sanitized = Math.max(1, Math.round(parsed));
          slidesCfg.heroTimelineMaxEntries = sanitized;
          maxInput.value = String(sanitized);
        } else {
          delete slidesCfg.heroTimelineMaxEntries;
          maxInput.value = '';
        }
        if (!maxInput.dataset.bound) {
          maxInput.dataset.bound = '1';
          maxInput.addEventListener('change', () => {
            const slides = ensureSlides();
            const value = Number(maxInput.value);
            if (Number.isFinite(value) && value > 0) {
              const sanitized = Math.max(1, Math.round(value));
              slides.heroTimelineMaxEntries = sanitized;
              maxInput.value = String(sanitized);
            } else {
              delete slides.heroTimelineMaxEntries;
              maxInput.value = '';
            }
            notifySettingsChanged();
          });
        }
      }

      const scrollSpeedInput = document.getElementById('heroTimelineScrollSpeed');
      if (scrollSpeedInput) {
        const slidesCfg = ensureSlides();
        const defaultSpeed = Number(DEFAULTS.slides?.heroTimelineScrollSpeed) || 40;
        const raw = Number(slidesCfg.heroTimelineScrollSpeed);
        const speed = Number.isFinite(raw) && raw > 0 ? Math.max(40, Math.round(raw)) : defaultSpeed;
        scrollSpeedInput.value = String(speed);
        if (!scrollSpeedInput.dataset.bound) {
          scrollSpeedInput.dataset.bound = '1';
          scrollSpeedInput.addEventListener('change', () => {
            const slides = ensureSlides();
            const value = Number(scrollSpeedInput.value);
            if (Number.isFinite(value) && value > 0) {
              const sanitized = Math.max(40, Math.round(value));
              slides.heroTimelineScrollSpeed = sanitized;
              scrollSpeedInput.value = String(sanitized);
            } else {
              delete slides.heroTimelineScrollSpeed;
              scrollSpeedInput.value = String(Number(DEFAULTS.slides?.heroTimelineScrollSpeed) || 40);
            }
            notifySettingsChanged();
          });
        }
      }

      const scrollPauseInput = document.getElementById('heroTimelineScrollPause');
      if (scrollPauseInput) {
        const slidesCfg = ensureSlides();
        const defaultPause = Number(DEFAULTS.slides?.heroTimelineScrollPauseMs) || 4000;
        const raw = Number(slidesCfg.heroTimelineScrollPauseMs);
        const normalizeDisplay = (ms) => {
          const seconds = Math.max(0, Math.round(ms));
          return String(Math.round((seconds / 1000) * 10) / 10);
        };
        const pauseMs = Number.isFinite(raw) && raw >= 0
          ? Math.max(0, Math.round(raw < 1000 ? raw * 1000 : raw))
          : defaultPause;
        scrollPauseInput.value = normalizeDisplay(pauseMs);
        if (!scrollPauseInput.dataset.bound) {
          scrollPauseInput.dataset.bound = '1';
          scrollPauseInput.addEventListener('change', () => {
            const slides = ensureSlides();
            const value = Number(scrollPauseInput.value);
            if (Number.isFinite(value) && value >= 0) {
              const sanitized = Math.max(0, value);
              const msValue = Math.round(sanitized * 1000);
              slides.heroTimelineScrollPauseMs = msValue;
              scrollPauseInput.value = normalizeDisplay(msValue);
            } else {
              delete slides.heroTimelineScrollPauseMs;
              const fallbackMs = Number(DEFAULTS.slides?.heroTimelineScrollPauseMs) || 4000;
              scrollPauseInput.value = normalizeDisplay(fallbackMs);
            }
            notifySettingsChanged();
          });
        }
      }

      const waitInput = document.getElementById('heroTimelineWaitForScroll');
      if (waitInput) {
        const slidesCfg = ensureSlides();
        waitInput.checked = !!slidesCfg.heroTimelineWaitForScroll;
        if (!waitInput.dataset.bound) {
          waitInput.dataset.bound = '1';
          waitInput.addEventListener('change', () => {
            const slides = ensureSlides();
            if (waitInput.checked) {
              slides.heroTimelineWaitForScroll = true;
            } else {
              delete slides.heroTimelineWaitForScroll;
            }
            notifySettingsChanged();
          });
        }
      }
    };

    const renderBackgroundAudioControls = () => {
      const defaults = DEFAULTS.audio?.background || {};
      settings.audio = (settings.audio && typeof settings.audio === 'object') ? settings.audio : {};
      let backgroundState = sanitizeBackgroundAudio(settings.audio.background, defaults);
      settings.audio.background = backgroundState;

      const enabledInput = document.getElementById('bgAudioEnabled');
      const enabledLabel = document.getElementById('bgAudioEnabledLabel');
      const enableSwitch = document.getElementById('bgAudioEnableSwitch');
      const trackSelect = document.getElementById('bgAudioTrackSelect');
      const labelInput = document.getElementById('bgAudioTrackLabel');
      const srcInput = document.getElementById('bgAudioSrc');
      const uploadBtn = document.getElementById('bgAudioUpload');
      const clearBtn = document.getElementById('bgAudioClear');
      const volumeInput = document.getElementById('bgAudioVolume');
      const loopInput = document.getElementById('bgAudioLoop');
      const saveBtn = document.getElementById('bgAudioTrackSave');
      const createBtn = document.getElementById('bgAudioTrackCreate');
      const deleteBtn = document.getElementById('bgAudioTrackDelete');

      const trackIds = Object.keys(backgroundState.tracks || {});
      let currentTrackId = backgroundState.activeTrack && backgroundState.tracks?.[backgroundState.activeTrack]
        ? backgroundState.activeTrack
        : (trackIds[0] || '');

      const getTracks = () => (backgroundState.tracks && typeof backgroundState.tracks === 'object') ? backgroundState.tracks : {};
      const getTrack = (id) => {
        if (!id) return null;
        const track = getTracks()[id];
        return track && typeof track === 'object' ? track : null;
      };

      const updateDeleteState = () => {
        if (!deleteBtn) return;
        deleteBtn.disabled = Object.keys(getTracks()).length <= 1;
      };

      const ensureEnabledState = () => {
        const active = getTrack(backgroundState.activeTrack);
        const isEnabled = !!(backgroundState.enabled && active && active.src);
        backgroundState.enabled = isEnabled;
        if (enabledInput) {
          enabledInput.checked = isEnabled;
          enabledInput.setAttribute('aria-checked', isEnabled ? 'true' : 'false');
        }
        if (enableSwitch) {
          enableSwitch.classList.toggle('is-on', isEnabled);
        }
        if (enabledLabel) {
          enabledLabel.textContent = isEnabled ? 'Aktiv' : 'Aus';
        }
      };

      const refreshTrackSelect = () => {
        if (!trackSelect) return;
        const tracks = getTracks();
        const ids = Object.keys(tracks);
        if (!tracks[currentTrackId]) {
          currentTrackId = backgroundState.activeTrack && tracks[backgroundState.activeTrack]
            ? backgroundState.activeTrack
            : (ids[0] || '');
        }
        trackSelect.innerHTML = '';
        if (!ids.length) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'Keine Presets';
          trackSelect.appendChild(opt);
          trackSelect.value = '';
          trackSelect.disabled = true;
          return;
        }
        ids.forEach((id) => {
          const track = tracks[id] || {};
          const label = typeof track.label === 'string' && track.label.trim() ? track.label.trim() : id;
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = label;
          trackSelect.appendChild(opt);
        });
        trackSelect.disabled = false;
        trackSelect.value = currentTrackId;
      };

      const updateInputs = () => {
        const track = getTrack(currentTrackId) || {};
        if (labelInput) labelInput.value = typeof track.label === 'string' ? track.label : '';
        if (srcInput) srcInput.value = typeof track.src === 'string' ? track.src : '';
        if (volumeInput) {
          const volume = Number(track.volume);
          const fallbackVolume = Number(defaults.volume ?? 1);
          const normalized = Number.isFinite(volume)
            ? Math.min(1, Math.max(0, volume))
            : (Number.isFinite(fallbackVolume) ? Math.min(1, Math.max(0, fallbackVolume)) : 1);
          volumeInput.value = String(Math.round(normalized * 100));
        }
        if (loopInput) loopInput.checked = track.loop === false ? false : true;
      };

      const syncUI = () => {
        refreshTrackSelect();
        updateInputs();
        ensureEnabledState();
        updateDeleteState();
      };

      const sanitizeAndSync = () => {
        backgroundState = sanitizeBackgroundAudio(backgroundState, defaults);
        settings.audio.background = backgroundState;
        if (!getTrack(currentTrackId)) {
          const tracks = getTracks();
          currentTrackId = backgroundState.activeTrack && tracks[backgroundState.activeTrack]
            ? backgroundState.activeTrack
            : (Object.keys(tracks)[0] || '');
        }
        syncUI();
      };

      syncUI();

      if (trackSelect && !trackSelect.dataset.bound) {
        trackSelect.dataset.bound = '1';
        trackSelect.addEventListener('change', () => {
          const nextId = trackSelect.value;
          const hasTrack = nextId && getTrack(nextId);
          if (hasTrack) {
            currentTrackId = nextId;
            backgroundState.activeTrack = nextId;
          } else if (!nextId) {
            backgroundState.activeTrack = '';
          }
          sanitizeAndSync();
          notifySettingsChanged();
          renderStyleAutomationControls();
        });
      }

      if (labelInput && !labelInput.dataset.bound) {
        labelInput.dataset.bound = '1';
        labelInput.addEventListener('input', () => {
          const track = getTrack(currentTrackId);
          if (!track) return;
          track.label = labelInput.value;
          refreshTrackSelect();
          notifySettingsChanged();
        });
        const commitLabel = () => {
          const track = getTrack(currentTrackId);
          if (!track) return;
          track.label = labelInput.value;
          sanitizeAndSync();
          renderStyleAutomationControls();
        };
        labelInput.addEventListener('change', commitLabel);
        labelInput.addEventListener('blur', commitLabel);
      }

      if (srcInput && !srcInput.dataset.bound) {
        srcInput.dataset.bound = '1';
        const commitSrc = () => {
          const track = getTrack(currentTrackId);
          if (!track) return;
          track.src = typeof srcInput.value === 'string' ? srcInput.value.trim() : '';
          if (backgroundState.activeTrack === currentTrackId && !track.src) {
            backgroundState.enabled = false;
          }
          sanitizeAndSync();
          notifySettingsChanged();
          renderStyleAutomationControls();
        };
        srcInput.addEventListener('change', commitSrc);
        srcInput.addEventListener('blur', commitSrc);
      }

      if (volumeInput && !volumeInput.dataset.bound) {
        volumeInput.dataset.bound = '1';
        const commitVolume = () => {
          const track = getTrack(currentTrackId);
          if (!track) return;
          const raw = Number(volumeInput.value);
          if (Number.isFinite(raw)) {
            const percent = Math.max(0, Math.min(100, Math.round(raw)));
            volumeInput.value = String(percent);
            track.volume = percent / 100;
          } else {
            const fallbackPercent = Math.round(Math.min(1, Math.max(0, Number(defaults.volume ?? 1))) * 100);
            volumeInput.value = String(fallbackPercent);
            track.volume = fallbackPercent / 100;
          }
          sanitizeAndSync();
          notifySettingsChanged();
        };
        volumeInput.addEventListener('change', commitVolume);
        volumeInput.addEventListener('blur', commitVolume);
      }

      if (loopInput && !loopInput.dataset.bound) {
        loopInput.dataset.bound = '1';
        loopInput.addEventListener('change', () => {
          const track = getTrack(currentTrackId);
          if (!track) return;
          track.loop = !!loopInput.checked;
          sanitizeAndSync();
          notifySettingsChanged();
        });
      }

      if (enabledInput && !enabledInput.dataset.bound) {
        enabledInput.dataset.bound = '1';
        enabledInput.addEventListener('change', () => {
          if (enabledInput.checked) {
            const active = getTrack(backgroundState.activeTrack);
            if (!active || !active.src) {
              enabledInput.checked = false;
              backgroundState.enabled = false;
            } else {
              backgroundState.enabled = true;
            }
          } else {
            backgroundState.enabled = false;
          }
          sanitizeAndSync();
          notifySettingsChanged();
          renderStyleAutomationControls();
        });
      }

      if (uploadBtn && !uploadBtn.dataset.bound) {
        uploadBtn.dataset.bound = '1';
        uploadBtn.addEventListener('click', () => {
          const track = getTrack(currentTrackId);
          if (!track) return;
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'audio/*';
          fileInput.onchange = () => {
            uploadGeneric(fileInput, (path) => {
              if (!path) return;
              track.src = path;
              backgroundState.activeTrack = currentTrackId;
              backgroundState.enabled = true;
              sanitizeAndSync();
              notifySettingsChanged();
              renderStyleAutomationControls();
            });
          };
          fileInput.click();
        });
      }

      if (clearBtn && !clearBtn.dataset.bound) {
        clearBtn.dataset.bound = '1';
        clearBtn.addEventListener('click', () => {
          const track = getTrack(currentTrackId);
          if (!track) return;
          track.src = '';
          if (backgroundState.activeTrack === currentTrackId) {
            backgroundState.enabled = false;
          }
          sanitizeAndSync();
          notifySettingsChanged();
        });
      }

      if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = '1';
        saveBtn.addEventListener('click', () => {
          sanitizeAndSync();
          notifySettingsChanged();
          renderStyleAutomationControls();
        });
      }

      if (createBtn && !createBtn.dataset.bound) {
        createBtn.dataset.bound = '1';
        createBtn.addEventListener('click', () => {
          const tracks = getTracks();
          const newId = genId('bgm_');
          const baseVolume = Math.min(1, Math.max(0, Number(defaults.volume ?? 1) || 1));
          tracks[newId] = {
            label: 'Neue Musik',
            src: '',
            volume: baseVolume,
            loop: defaults.loop === false ? false : true
          };
          backgroundState.activeTrack = newId;
          currentTrackId = newId;
          sanitizeAndSync();
          notifySettingsChanged();
          renderStyleAutomationControls();
        });
      }

      if (deleteBtn && !deleteBtn.dataset.bound) {
        deleteBtn.dataset.bound = '1';
        deleteBtn.addEventListener('click', () => {
          const tracks = getTracks();
          if (Object.keys(tracks).length <= 1) return;
          delete tracks[currentTrackId];
          if (backgroundState.activeTrack === currentTrackId) {
            backgroundState.activeTrack = Object.keys(tracks)[0] || '';
          }
          currentTrackId = backgroundState.activeTrack && tracks[backgroundState.activeTrack]
            ? backgroundState.activeTrack
            : (Object.keys(tracks)[0] || '');
          sanitizeAndSync();
          notifySettingsChanged();
          renderStyleAutomationControls();
        });
      }
    };

    const renderPagePlaylist = (hostId, playlistList = [], { pageKey = 'left' } = {}) => {
      const host = document.getElementById(hostId);
      if (!host) return;
      const normalizedKey = pageKey === 'right' ? 'right' : 'left';
      const displayCfg = settings.display = settings.display || {};
      const pagesCfg = displayCfg.pages = displayCfg.pages || {};
      const pageState = pagesCfg[normalizedKey] = pagesCfg[normalizedKey] || {};
      const sanitized = sanitizePagePlaylist(Array.isArray(playlistList) ? playlistList : pageState.playlist);
      const existing = Array.isArray(pageState.playlist) ? pageState.playlist : [];
      if (JSON.stringify(existing) !== JSON.stringify(sanitized)) {
        pageState.playlist = sanitized;
      }

      const { entries: baseEntries, hiddenSaunas, statusBySauna } = collectSlideOrderStream({ normalizeSortOrder: false });
      const showOverview = settings?.slides?.showOverview !== false;
      const heroEnabled = !!(settings?.slides?.heroEnabled);

      const entryList = [];
      const entryMap = new Map();
      const pushEntry = (entry) => {
        entryList.push(entry);
        entryMap.set(entry.key, entry);
      };

      pushEntry({
        key: 'overview',
        kind: 'overview',
        label: 'Übersicht',
        thumb: thumbFallback,
        disabled: !showOverview,
        statusText: showOverview ? null : 'Deaktiviert'
      });

      pushEntry({
        key: 'hero-timeline',
        kind: 'hero-timeline',
        label: 'Event Countdown',
        thumb: thumbFallback,
        disabled: !heroEnabled,
        statusText: heroEnabled ? null : 'Deaktiviert'
      });

      baseEntries.forEach(entry => {
        if (!entry) return;
        if (entry.kind === 'sauna') {
          const name = entry.name || '';
          if (!name) return;
          const status = statusBySauna?.[name] || SAUNA_STATUS.ACTIVE;
          const disabled = status !== SAUNA_STATUS.ACTIVE;
          const statusText = disabled ? (SAUNA_STATUS_TEXT[status] || 'Ausgeblendet') : null;
          pushEntry({
            key: 'sauna:' + name,
            kind: 'sauna',
            name,
            label: name,
            thumb: settings.assets?.rightImages?.[name] || '',
            disabled,
            statusText
          });
        } else if (entry.kind === 'media') {
          const id = entry.item?.id != null ? String(entry.item.id) : '';
          if (!id) return;
          pushEntry({
            key: 'media:' + id,
            kind: 'media',
            id,
            label: entry.item?.name || '(unbenannt)',
            thumb: entry.item?.thumb || entry.item?.url || '',
            disabled: entry.item?.enabled === false,
            statusText: entry.item?.enabled === false ? 'Deaktiviert' : null
          });
        } else if (entry.kind === 'story') {
          const storyId = entry.item?.id != null ? String(entry.item.id) : (entry.key || '');
          if (!storyId) return;
          pushEntry({
            key: 'story:' + storyId,
            kind: 'story',
            id: storyId,
            label: entry.item?.title || 'Story-Slide',
            thumb: entry.item?.heroUrl || thumbFallback,
            disabled: entry.item?.enabled === false,
            statusText: entry.item?.enabled === false ? 'Deaktiviert' : null
          });
        } else if (entry.kind === 'wellness-tip') {
          const data = entry.item || {};
          const tipId = data.id != null ? String(data.id) : (entry.key || '');
          if (!tipId) return;
          const icon = data.icon ? `${data.icon} ` : '';
          const baseLabel = (data.label || data.title || 'Wellness-Tipp').trim();
          const count = Number(data.count);
          const hasCount = Number.isFinite(count) && count >= 0;
          const suffix = hasCount ? ` (${count})` : '';
          const statusText = data.statusText || null;
          const disabled = data.disabled === true;
          pushEntry({
            key: 'wellness:' + tipId,
            kind: 'wellness-tip',
            id: tipId,
            label: icon + baseLabel + suffix,
            thumb: '',
            disabled,
            statusText: disabled ? (statusText || 'Keine aktiven Tipps') : (statusText || null)
          });
        }
      });

      const selectedKeys = sanitized.map(playlistKeyFromSanitizedEntry).filter(Boolean);
      const orderList = [];
      const seenKeys = new Set();
      selectedKeys.forEach(key => {
        const entry = entryMap.get(key);
        if (entry && !seenKeys.has(key)) {
          orderList.push(entry);
          seenKeys.add(key);
        }
      });
      entryList.forEach(entry => {
        if (!seenKeys.has(entry.key)) {
          orderList.push(entry);
          seenKeys.add(entry.key);
        }
      });

      const selected = new Set();
      selectedKeys.forEach(key => {
        if (seenKeys.has(key)) selected.add(key);
      });

      const hasStoredSelection = Array.isArray(playlistList) ? playlistList.length > 0 : Array.isArray(pageState.playlist) && pageState.playlist.length > 0;

      if (!selected.size && !hasStoredSelection) {
        orderList.forEach(entry => {
          if (!entry || entry.disabled) return;
          selected.add(entry.key);
        });
      }

      host.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'slide-order-grid';
      host.appendChild(grid);

      const DROP_BEFORE = 'drop-before';
      const DROP_AFTER = 'drop-after';
      let draggedEntry = null;

      const clearDropIndicators = () => {
        grid.querySelectorAll('.slide-order-tile').forEach(tile => tile.classList.remove(DROP_BEFORE, DROP_AFTER));
      };

      const isBeforeTarget = (event, target) => {
        const rect = target.getBoundingClientRect();
        const horizontal = rect.width > rect.height;
        return horizontal
          ? (event.clientX < rect.left + rect.width / 2)
          : (event.clientY < rect.top + rect.height / 2);
      };

      const commitPlaylist = () => {
        const next = [];
        for (const entry of orderList) {
          if (!selected.has(entry.key)) continue;
          switch (entry.kind) {
            case 'overview':
              next.push({ type: 'overview' });
              break;
            case 'hero-timeline':
              next.push({ type: 'hero-timeline' });
              break;
            case 'sauna':
              next.push({ type: 'sauna', name: entry.name });
              break;
            case 'media':
              next.push({ type: 'media', id: entry.id });
              break;
            case 'story':
              next.push({ type: 'story', id: entry.id });
              break;
            case 'wellness-tip':
              next.push({ type: 'wellness-tip', id: entry.id });
              break;
            default:
              break;
          }
        }
        const prevStr = JSON.stringify(Array.isArray(pageState.playlist) ? pageState.playlist : []);
        const nextStr = JSON.stringify(next);
        pageState.playlist = next;
        if (normalizedKey === 'left') {
          const layoutSelect = document.getElementById('layoutMode');
          const layoutModeValue = layoutSelect?.value === 'split' ? 'split' : 'single';
          if (layoutModeValue !== 'split') {
            const sortOrder = [];
            next.forEach(entry => {
              if (!entry || typeof entry !== 'object') return;
              if (entry.type === 'sauna' && entry.name) {
                sortOrder.push({ type: 'sauna', name: entry.name });
              } else if (entry.type === 'media' && entry.id != null) {
                sortOrder.push({ type: 'media', id: entry.id });
              } else if (entry.type === 'story' && entry.id != null) {
                sortOrder.push({ type: 'story', id: entry.id });
              }
            });
            const prevSortStr = JSON.stringify(Array.isArray(settings.slides?.sortOrder) ? settings.slides.sortOrder : []);
            settings.slides ||= {};
            if (sortOrder.length) settings.slides.sortOrder = sortOrder;
            else delete settings.slides.sortOrder;
            const nextSortStr = JSON.stringify(sortOrder);
            if (prevSortStr !== nextSortStr && prevStr === nextStr) {
              setUnsavedState(true);
              if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
            }
          }
        }
        if (prevStr !== nextStr) {
          setUnsavedState(true);
          if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
        }
      };

      const moveEntry = (entry, dir) => {
        const idx = orderList.indexOf(entry);
        if (idx === -1) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= orderList.length) return;
        orderList.splice(idx, 1);
        orderList.splice(newIdx, 0, entry);
        commitPlaylist();
        renderTiles();
      };

      const reorderEntries = (source, target, before) => {
        const fromIdx = orderList.indexOf(source);
        const toIdx = orderList.indexOf(target);
        if (fromIdx === -1 || toIdx === -1 || source === target) return;
        orderList.splice(fromIdx, 1);
        let insertIdx = before ? toIdx : toIdx + 1;
        if (insertIdx > fromIdx) insertIdx--;
        orderList.splice(insertIdx, 0, source);
        commitPlaylist();
        renderTiles();
      };

      const toggleEntry = (entry) => {
        const isSelected = selected.has(entry.key);
        if (entry.disabled && !isSelected) return;
        if (isSelected) selected.delete(entry.key);
        else selected.add(entry.key);
        commitPlaylist();
        renderTiles();
      };

      const renderTiles = () => {
        grid.innerHTML = '';
        orderList.forEach((entry, idx) => {
          const tile = document.createElement('div');
          tile.className = 'slide-order-tile';
          tile.dataset.key = entry.key;
          tile.dataset.idx = String(idx);
          const isSelected = selected.has(entry.key);
          if (!isSelected) tile.classList.add('is-unselected');
          if (entry.disabled) tile.classList.add('is-disabled');
          if (entry.kind === 'sauna' && hiddenSaunas.has(entry.name)) tile.classList.add('is-hidden');

          const title = document.createElement('div');
          title.className = 'title';
          title.textContent = entry.label || '';
          tile.appendChild(title);

          if (entry.statusText) {
            const statusEl = document.createElement('div');
            statusEl.className = 'slide-status';
            statusEl.textContent = entry.statusText;
            tile.appendChild(statusEl);
          }

          if (entry.thumb) {
            const img = document.createElement('img');
            img.src = entry.thumb;
            img.alt = entry.label || '';
            tile.appendChild(img);
          }

          const stateBadge = document.createElement('div');
          stateBadge.className = 'playlist-state';
          stateBadge.textContent = isSelected ? 'Aktiv' : 'Inaktiv';
          tile.appendChild(stateBadge);

          if (isSelected) {
            const controls = document.createElement('div');
            controls.className = 'reorder-controls';

            const makeCtrlButton = (dir, label) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = `reorder-btn ${dir > 0 ? 'reorder-down' : 'reorder-up'}`;
              btn.title = label;
              btn.setAttribute('aria-label', label);
              btn.innerHTML = dir < 0
                ? '<svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="M8 3.5 12.5 8l-.7.7L8 4.9 4.2 8.7l-.7-.7Z"/></svg>'
                : '<svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="m8 12.5-4.5-4.5.7-.7L8 11.1l3.8-3.8.7.7Z"/></svg>';
              btn.addEventListener('click', ev => {
                ev.stopPropagation();
                moveEntry(entry, dir);
              });
              btn.addEventListener('pointerdown', ev => ev.stopPropagation());
              btn.addEventListener('mousedown', ev => ev.stopPropagation());
              btn.addEventListener('touchstart', ev => ev.stopPropagation());
              btn.draggable = false;
              return btn;
            };

            controls.appendChild(makeCtrlButton(-1, 'Nach oben verschieben'));
            controls.appendChild(makeCtrlButton(1, 'Nach unten verschieben'));

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'reorder-btn playlist-remove';
            removeBtn.innerHTML = '✕';
            removeBtn.title = 'Aus Playlist entfernen';
            removeBtn.setAttribute('aria-label', 'Aus Playlist entfernen');
            removeBtn.addEventListener('click', ev => {
              ev.stopPropagation();
              selected.delete(entry.key);
              commitPlaylist();
              renderTiles();
            });
            controls.appendChild(removeBtn);
            tile.appendChild(controls);
          }

          tile.addEventListener('click', ev => {
            if (ev.target.closest('.reorder-controls')) return;
            toggleEntry(entry);
          });

          if (selected.has(entry.key)) {
            tile.draggable = true;
            tile.addEventListener('dragstart', ev => {
              draggedEntry = entry;
              tile.classList.add('dragging');
              ev.dataTransfer?.setData('text/plain', entry.key);
              ev.dataTransfer.effectAllowed = 'move';
            });
            tile.addEventListener('dragend', () => {
              draggedEntry = null;
              tile.classList.remove('dragging');
              clearDropIndicators();
            });
          } else {
            tile.draggable = false;
          }

          tile.addEventListener('dragenter', ev => {
            if (!draggedEntry || draggedEntry === entry) return;
            ev.preventDefault();
            const before = isBeforeTarget(ev, tile);
            clearDropIndicators();
            tile.classList.add(before ? DROP_BEFORE : DROP_AFTER);
          });

          tile.addEventListener('dragover', ev => {
            if (!draggedEntry || draggedEntry === entry) return;
            ev.preventDefault();
            const before = isBeforeTarget(ev, tile);
            clearDropIndicators();
            tile.classList.add(before ? DROP_BEFORE : DROP_AFTER);
          });

          tile.addEventListener('dragleave', ev => {
            if (tile.contains(ev.relatedTarget)) return;
            tile.classList.remove(DROP_BEFORE, DROP_AFTER);
          });

          tile.addEventListener('drop', ev => {
            if (!draggedEntry || draggedEntry === entry) return;
            ev.preventDefault();
            const before = isBeforeTarget(ev, tile);
            clearDropIndicators();
            reorderEntries(draggedEntry, entry, before);
          });

          grid.appendChild(tile);
        });
      };

      if (!grid.dataset.dndBound) {
        grid.addEventListener('dragover', ev => {
          if (draggedEntry) ev.preventDefault();
        });
        grid.addEventListener('drop', ev => {
          if (draggedEntry) ev.preventDefault();
          draggedEntry = null;
          clearDropIndicators();
        });
        grid.dataset.dndBound = '1';
      }

      renderTiles();
      if (normalizedKey === 'left') {
        const layoutSelect = document.getElementById('layoutMode');
        if ((layoutSelect?.value === 'split' ? 'split' : 'single') !== 'split') {
          commitPlaylist();
        }
      }
    };

    // Schrift
    setV('#fontFamily', f.family ?? DEFAULTS.fonts.family);
    setV('#fontScale',  f.scale  ?? 1);
    setV('#h1Scale',    f.h1Scale ?? 1);
    setV('#h2Scale',    f.h2Scale ?? 1);
    setV('#tileTimeScale', f.tileTimeScale ?? f.tileMetaScale ?? 1);
    setV('#tileTimeWeight', f.tileTimeWeight ?? f.tileWeight ?? 600);
    setC('#timeSuffixToggle', settings.slides?.appendTimeSuffix === true);
    setV('#tileFlameSizeScale', settings.slides?.tileFlameSizeScale ?? DEFAULTS.slides.tileFlameSizeScale ?? 1);
    setV('#tileFlameGapScale', settings.slides?.tileFlameGapScale ?? DEFAULTS.slides.tileFlameGapScale ?? 1);
    const saunaFlameControls = ['#tileFlameSizeScale', '#tileFlameGapScale'].map(sel => document.querySelector(sel));
    const saunaFlamesToggle = document.getElementById('saunaFlames');
    const saunaFlamesEnabled = (settings.slides?.showSaunaFlames !== false);
    setC('#saunaFlames', saunaFlamesEnabled);
    const applySaunaFlameState = (enabled) => { saunaFlameControls.forEach(el => { if (el) el.disabled = !enabled; }); };
    applySaunaFlameState(saunaFlamesEnabled);
    if (saunaFlamesToggle && !saunaFlamesToggle.dataset.bound) {
      saunaFlamesToggle.addEventListener('change', () => applySaunaFlameState(saunaFlamesToggle.checked));
      saunaFlamesToggle.dataset.bound = '1';
    }
    setC('#badgeInlineColumn', settings.slides?.badgeInlineColumn === true);
    setV('#chipOverflowMode', f.chipOverflowMode ?? 'scale');
    setV('#flamePct',         f.flamePct         ?? 55);
    setV('#flameGap',         f.flameGapScale    ?? 0.14);

    // H2
    setV('#h2Mode', settings.h2?.mode ?? DEFAULTS.h2.mode);
    setV('#h2Text', settings.h2?.text ?? DEFAULTS.h2.text);
    setC('#h2ShowOverview', (settings.h2?.showOnOverview ?? DEFAULTS.h2.showOnOverview));

    // Übersicht (Tabelle)
    setV('#ovTitleScale', f.overviewTitleScale ?? 1);
    setV('#ovHeadScale',  f.overviewHeadScale  ?? 0.9);
    setV('#ovCellScale',  f.overviewCellScale  ?? 0.8);
    setV('#ovTimeScale',  f.overviewTimeScale  ?? f.overviewCellScale ?? 0.8);
    setV('#ovTimeWidthScale', resolveOverviewTimeWidthScale(f, {
      fallback: DEFAULTS.fonts?.overviewTimeWidthScale ?? 1
    }));
    setV('#chipH',        Math.round((f.chipHeight ?? 1)*100));
    const overviewFlamesToggle = document.getElementById('overviewFlames');
    const overviewFlameControls = ['#flamePct', '#flameGap'].map(sel => document.querySelector(sel));
    const applyOverviewFlameState = (enabled) => {
      overviewFlameControls.forEach(el => { if (el) el.disabled = !enabled; });
    };
    const overviewFlamesEnabled = (f.overviewShowFlames !== false);
    setC('#overviewFlames', overviewFlamesEnabled);
    applyOverviewFlameState(overviewFlamesEnabled);
    if (overviewFlamesToggle && !overviewFlamesToggle.dataset.bound){
      overviewFlamesToggle.addEventListener('change', () => applyOverviewFlameState(overviewFlamesToggle.checked));
      overviewFlamesToggle.dataset.bound = '1';
    }

    // Saunafolien (Kacheln)
    setV('#tileTextScale', f.tileTextScale ?? 0.8);
    setV('#tileWeight',    f.tileWeight    ?? 600);
    setV('#tilePct',       settings.slides?.tileWidthPercent ?? 45);
    setV('#tileMin',       settings.slides?.tileMinScale ?? 0.25);
    setV('#tileMax',       settings.slides?.tileMaxScale ?? 0.57);
    const headingStored = settings.slides?.saunaTitleMaxWidthPercent
      ?? DEFAULTS.slides.saunaTitleMaxWidthPercent
      ?? SAUNA_HEADING_WIDTH_LIMITS.inputMax;
    const headingInputValue = mapSaunaHeadingWidthToInput(headingStored);
    setV('#saunaHeadingWidth', Math.round(headingInputValue * 10) / 10);
    setV('#tileHeightScale', settings.slides?.tileHeightScale ?? DEFAULTS.slides.tileHeightScale ?? 1);
    setV('#tilePaddingScale', settings.slides?.tilePaddingScale ?? DEFAULTS.slides.tilePaddingScale ?? 0.75);
    setV('#badgeScale', settings.slides?.badgeScale ?? DEFAULTS.slides.badgeScale ?? 1);
    setV('#badgeDescriptionScale', settings.slides?.badgeDescriptionScale ?? DEFAULTS.slides.badgeDescriptionScale ?? 1);
    const overlayCheckbox = document.getElementById('tileOverlayEnabled');
    const overlayInput = document.getElementById('tileOverlayStrength');
    const overlayEnabled = (settings.slides?.tileOverlayEnabled !== false);
    setC('#tileOverlayEnabled', overlayEnabled);
    const overlayPct = (() => {
      const raw = settings.slides?.tileOverlayStrength;
      if (!Number.isFinite(+raw)) return 100;
      return Math.round(Math.max(0, +raw) * 100);
    })();
    setV('#tileOverlayStrength', overlayPct);
    const applyOverlayState = (enabled) => { if (overlayInput) overlayInput.disabled = !enabled; };
    applyOverlayState(overlayEnabled);
    if (overlayCheckbox && !overlayCheckbox.dataset.bound) {
      overlayCheckbox.addEventListener('change', () => applyOverlayState(overlayCheckbox.checked));
      overlayCheckbox.dataset.bound = '1';
    }
    const badgeColor = settings.slides?.infobadgeColor || settings.theme?.accent || DEFAULTS.slides.infobadgeColor;
    setV('#badgeColor', badgeColor);

    // Bildspalte / Schrägschnitt
    setV('#rightW',   settings.display?.rightWidthPercent ?? 38);
    setV('#infoPanelWidth', settings.display?.infoPanelWidthPercent ?? DEFAULTS.display?.infoPanelWidthPercent ?? 32);
    setV('#portraitSplitTop', settings.display?.portraitSplitTopPercent ?? DEFAULTS.display?.portraitSplitTopPercent ?? 58);
    setV('#cutTop',   settings.display?.cutTopPercent ?? 28);
    setV('#cutBottom',settings.display?.cutBottomPercent ?? 12);
    setV('#infoBannerHeight', settings.display?.infoBannerHeightPercent ?? DEFAULTS.display?.infoBannerHeightPercent ?? 10);

    const readRangeNumericValue = (input) => {
      if (!input) return null;
      const viaProp = Number(input.valueAsNumber);
      if (Number.isFinite(viaProp)) return viaProp;
      const parsed = Number(input.value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const readRangeBound = (raw) => {
      if (raw == null || raw === '') return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const clampRangeValue = (input, value) => {
      if (!Number.isFinite(value)) return null;
      const min = readRangeBound(input?.min);
      const max = readRangeBound(input?.max);
      let normalized = Math.round(value);
      if (Number.isFinite(min)) normalized = Math.max(min, normalized);
      if (Number.isFinite(max)) normalized = Math.min(max, normalized);
      return normalized;
    };

    const applyPercentOutput = (input, output, value) => {
      if (value == null) {
        if (output) {
          output.textContent = '';
          if ('value' in output) output.value = '';
        }
        return null;
      }
      if (input && input.value !== String(value)) input.value = String(value);
      const label = `${value}%`;
      if (output) {
        output.textContent = label;
        if ('value' in output) output.value = label;
      }
      return value;
    };

    const updatePercentOutput = (input, output) => {
      if (!input) return null;
      const raw = readRangeNumericValue(input);
      const normalized = clampRangeValue(input, raw);
      return applyPercentOutput(input, output, normalized);
    };

    const bindRangeInput = (inputId, outputId, onValue) => {
      const input = document.getElementById(inputId);
      const output = document.getElementById(outputId);
      if (!input) return;
      let currentValue = null;
      const syncValue = (raw) => {
        const normalized = clampRangeValue(input, raw);
        return applyPercentOutput(input, output, normalized);
      };
      const applyValue = () => {
        const raw = readRangeNumericValue(input);
        const value = syncValue(raw);
        if (value == null || value === currentValue) return;
        currentValue = value;
        if (typeof onValue === 'function') onValue(value, input);
        notifySettingsChanged();
      };
      const initialRaw = readRangeNumericValue(input);
      const initial = syncValue(initialRaw);
      if (initial != null) {
        currentValue = initial;
        if (typeof onValue === 'function') onValue(initial, input);
      }
      if (input.dataset.bound) return;
      ['input', 'change'].forEach((evt) => {
        input.addEventListener(evt, applyValue);
      });
      input.dataset.bound = '1';
    };

    bindRangeInput('infoPanelWidth', 'infoPanelWidthOutput', (value, inputEl) => {
      const min = Number.isFinite(Number(inputEl?.min)) ? Number(inputEl.min) : 1;
      const max = Number.isFinite(Number(inputEl?.max)) ? Number(inputEl.max) : 100;
      const clamped = Math.max(min, Math.min(max, value));
      const displayCfg = ensureDisplaySettings();
      displayCfg.infoPanelWidthPercent = clamped;
    });
    bindRangeInput('portraitSplitTop', 'portraitSplitTopOutput', (value, inputEl) => {
      const min = Number.isFinite(Number(inputEl?.min)) ? Number(inputEl.min) : 1;
      const max = Number.isFinite(Number(inputEl?.max)) ? Number(inputEl.max) : 100;
      const clamped = Math.max(min, Math.min(max, value));
      const displayCfg = ensureDisplaySettings();
      displayCfg.portraitSplitTopPercent = clamped;
    });

    const infoBannerHeightInput = document.getElementById('infoBannerHeight');
    if (infoBannerHeightInput && !infoBannerHeightInput.dataset.bound) {
      infoBannerHeightInput.addEventListener('input', notifySettingsChanged);
      infoBannerHeightInput.dataset.bound = '1';
    }

    const infoBannerModeSelect = document.getElementById('infoBannerMode');
    if (infoBannerModeSelect) {
      const storedMode = (settings.display?.infoBannerMode || DEFAULTS.display?.infoBannerMode || 'full').toLowerCase();
      const normalizedMode = ['full', 'left', 'right'].includes(storedMode) ? storedMode : 'full';
      infoBannerModeSelect.value = normalizedMode;
      if (!infoBannerModeSelect.dataset.bound) {
        infoBannerModeSelect.addEventListener('change', notifySettingsChanged);
        infoBannerModeSelect.dataset.bound = '1';
      }
    }

    const display = settings.display || {};
    const pages = display.pages || {};
    const leftCfg = pages.left || {};
    const rightCfg = pages.right || {};
    const layoutMode = (display.layoutMode === 'split') ? 'split' : 'single';
    setV('#layoutMode', layoutMode);
    setV('#pageLeftTimer', leftCfg.timerSec ?? '');
    setV('#pageRightTimer', rightCfg.timerSec ?? '');
    renderPagePlaylist('pageLeftPlaylist', leftCfg.playlist, { pageKey: 'left' });
    renderPagePlaylist('pageRightPlaylist', rightCfg.playlist, { pageKey: 'right' });
    const layoutModeSelect = document.getElementById('layoutMode');
    const applyLayoutVisibility = (mode) => {
      const rightWrap = document.getElementById('layoutRight');
      if (rightWrap) rightWrap.hidden = (mode !== 'split');
    };
    applyLayoutVisibility(layoutMode);
    if (layoutModeSelect) {
      layoutModeSelect.onchange = () => applyLayoutVisibility(layoutModeSelect.value === 'split' ? 'split' : 'single');
    }

    const layoutProfileSelect = document.getElementById('layoutProfile');
    const portraitSplitRow = document.getElementById('portraitSplitRatioRow');
    const infoPanelWidthRow = document.getElementById('infoPanelWidthRow');
    const applyProfileVisibility = (profile) => {
      if (portraitSplitRow) portraitSplitRow.hidden = (profile !== 'portrait-split');
      if (infoPanelWidthRow) infoPanelWidthRow.hidden = (profile !== 'info-panel');
    };
    if (layoutProfileSelect) {
      const profile = settings.display?.layoutProfile || DEFAULTS.display?.layoutProfile || 'landscape';
      layoutProfileSelect.value = profile;
      applyProfileVisibility(profile);
      layoutProfileSelect.onchange = () => {
        settings.display = settings.display || {};
        const selected = layoutProfileSelect.value;
        settings.display.layoutProfile = selected;
        applyProfileVisibility(selected);
        notifySettingsChanged();
      };
    } else {
      applyProfileVisibility('landscape');
    }

    renderStyleAutomationControls();
    renderExtrasEditor();
    renderHeroTimelineControls();
    renderBackgroundAudioControls();

    // Reset-Button (nur Felder dieser Box)
    const reset = document.querySelector('#resetSlides');
    if (!reset) return;
    reset.onclick = ()=>{
      setV('#fontFamily', DEFAULTS.fonts.family);
      setV('#fontScale', 1);
      setV('#h1Scale', 1);
      setV('#h2Scale', 1);
      setV('#tileTimeScale', DEFAULTS.fonts.tileTimeScale ?? DEFAULTS.fonts.tileMetaScale);
      setV('#tileTimeWeight', DEFAULTS.fonts.tileTimeWeight ?? DEFAULTS.fonts.tileWeight ?? 600);

      setV('#h2Mode', DEFAULTS.h2.mode);
      setV('#h2Text', DEFAULTS.h2.text);
      setC('#h2ShowOverview', DEFAULTS.h2.showOnOverview);

      setV('#ovTitleScale', DEFAULTS.fonts.overviewTitleScale);
      setV('#ovHeadScale',  DEFAULTS.fonts.overviewHeadScale);
      setV('#ovCellScale',  DEFAULTS.fonts.overviewCellScale);
      setV('#ovTimeScale',  DEFAULTS.fonts.overviewTimeScale ?? DEFAULTS.fonts.overviewCellScale);
      setV('#ovTimeWidthScale',  DEFAULTS.fonts.overviewTimeWidthScale);
      setV('#chipH',        Math.round(DEFAULTS.fonts.chipHeight*100));
      setV('#chipOverflowMode', DEFAULTS.fonts.chipOverflowMode);
      setV('#flamePct',         DEFAULTS.fonts.flamePct);
      setV('#flameGap',         DEFAULTS.fonts.flameGapScale);
      setC('#overviewFlames',   DEFAULTS.fonts.overviewShowFlames);
      applyOverviewFlameState(DEFAULTS.fonts.overviewShowFlames);

      setV('#tileTextScale', DEFAULTS.fonts.tileTextScale);
      setV('#tileWeight',    DEFAULTS.fonts.tileWeight);
      setV('#tilePct',       DEFAULTS.slides.tileWidthPercent);
      setV('#tileMin',       DEFAULTS.slides.tileMinScale);
      setV('#tileMax',       DEFAULTS.slides.tileMaxScale);
      setV('#tileFlameSizeScale', DEFAULTS.slides.tileFlameSizeScale);
      setV('#tileFlameGapScale', DEFAULTS.slides.tileFlameGapScale);
      setV('#saunaHeadingWidth', Math.round(mapSaunaHeadingWidthToInput(DEFAULTS.slides.saunaTitleMaxWidthPercent) * 10) / 10);
      setV('#tileHeightScale', DEFAULTS.slides.tileHeightScale);
      setV('#tilePaddingScale', DEFAULTS.slides.tilePaddingScale);
      setV('#badgeScale',    DEFAULTS.slides.badgeScale);
      setV('#badgeDescriptionScale', DEFAULTS.slides.badgeDescriptionScale);
      setC('#saunaFlames', DEFAULTS.slides.showSaunaFlames !== false);
      applySaunaFlameState(DEFAULTS.slides.showSaunaFlames !== false);
      setC('#badgeInlineColumn', DEFAULTS.slides.badgeInlineColumn === true);
      setV('#badgeColor',    DEFAULTS.slides.infobadgeColor);
      setC('#tileOverlayEnabled', DEFAULTS.slides.tileOverlayEnabled);
      setV('#tileOverlayStrength', Math.round((DEFAULTS.slides.tileOverlayStrength ?? 1) * 100));
      applyOverlayState(DEFAULTS.slides.tileOverlayEnabled !== false);

      const audioDefaults = sanitizeBackgroundAudio(DEFAULTS.audio?.background, DEFAULTS.audio?.background || {});
      settings.audio = (settings.audio && typeof settings.audio === 'object') ? settings.audio : {};
      settings.audio.background = deepClone(audioDefaults);
      renderBackgroundAudioControls();
      renderStyleAutomationControls();

      setV('#rightW',   DEFAULTS.display.rightWidthPercent);
      setV('#infoPanelWidth', DEFAULTS.display.infoPanelWidthPercent);
      setV('#portraitSplitTop', DEFAULTS.display.portraitSplitTopPercent);
      setV('#cutTop',   DEFAULTS.display.cutTopPercent);
      setV('#cutBottom',DEFAULTS.display.cutBottomPercent);
      setV('#infoBannerHeight', DEFAULTS.display.infoBannerHeightPercent);
      const bannerModeSelect = document.getElementById('infoBannerMode');
      if (bannerModeSelect) {
        const defMode = (DEFAULTS.display.infoBannerMode || 'full').toLowerCase();
        bannerModeSelect.value = ['full', 'left', 'right'].includes(defMode) ? defMode : 'full';
      }
      setV('#layoutMode', DEFAULTS.display.layoutMode || 'single');
      setV('#layoutProfile', DEFAULTS.display.layoutProfile || 'landscape');
      const displayCfg = ensureDisplaySettings();
      displayCfg.infoPanelWidthPercent = DEFAULTS.display.infoPanelWidthPercent;
      displayCfg.portraitSplitTopPercent = DEFAULTS.display.portraitSplitTopPercent;
      updatePercentOutput(document.getElementById('infoPanelWidth'), document.getElementById('infoPanelWidthOutput'));
      updatePercentOutput(document.getElementById('portraitSplitTop'), document.getElementById('portraitSplitTopOutput'));
      applyProfileVisibility(DEFAULTS.display.layoutProfile || 'landscape');
      const defLeft = DEFAULTS.display.pages?.left || {};
      const defRight = DEFAULTS.display.pages?.right || {};
      setV('#pageLeftTimer', defLeft.timerSec ?? '');
      setV('#pageRightTimer', defRight.timerSec ?? '');
      const defLeftPlaylist = sanitizePagePlaylist(defLeft.playlist);
      const defRightPlaylist = sanitizePagePlaylist(defRight.playlist);
      const pagesCfg = displayCfg.pages = displayCfg.pages || {};
      const leftState = pagesCfg.left = pagesCfg.left || {};
      const rightState = pagesCfg.right = pagesCfg.right || {};
      leftState.contentTypes = Array.isArray(defLeft.contentTypes) ? defLeft.contentTypes.slice() : [];
      rightState.contentTypes = Array.isArray(defRight.contentTypes) ? defRight.contentTypes.slice() : [];
      leftState.playlist = defLeftPlaylist;
      rightState.playlist = defRightPlaylist;
      renderPagePlaylist('pageLeftPlaylist', defLeftPlaylist, { pageKey: 'left' });
      renderPagePlaylist('pageRightPlaylist', defRightPlaylist, { pageKey: 'right' });
      applyLayoutVisibility(DEFAULTS.display.layoutMode || 'single');
    };
  }
  return { renderSlidesBox };
}
