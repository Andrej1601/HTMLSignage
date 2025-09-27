/**
 * Lightweight contextual help system for the admin interface.
 *
 * @module ui/context_help
 */

const HELP_TOPICS = {
  'cockpit': {
    title: 'Cockpit-Schnellzugriff',
    description: 'Der kompakte Cockpit-Bereich bündelt Schnellzugriffe auf Vorschau, Geräteverwaltung und Inhaltsbereiche.',
    steps: [
      'Nutze die Karten oder Schnellaktionen, um direkt zu wichtigen Abschnitten zu springen.',
      'Mit den verlinkten Aktionen kannst du Vorschau oder Gerätebereich sofort öffnen.'
    ]
  },
  'view-menu': {
    title: 'Ansichten wechseln',
    description: 'Über das Ansichtsmenü schaltest du zwischen Planungsgrid und Vorschau um.',
    steps: [
      'Öffne das Menü, um zwischen „Grid“ und „Vorschau“ zu wählen.',
      'Tastenkürzel: 1 = Grid, 2 = Vorschau, 3 = Gerätebereich an/aus.'
    ]
  },
  'devices-panel': {
    title: 'Gerätebereich',
    description: 'Beobachte Heartbeats, benenne Geräte um oder wechsel in einen Geräte-Kontext.',
    steps: [
      'Klicke auf „Geräte“, um die Liste anzuheften.',
      'Nutze „Im Editor bearbeiten“, um direkt in den Kontext eines Geräts zu springen.'
    ]
  },
  'schedule': {
    title: 'Zeitplan bearbeiten',
    description: 'Das Grid zeigt dir Tages- und Wochenplanung. Drag & Drop und Copy & Paste werden unterstützt.',
    steps: [
      'Ziehe Elemente, um Zeiten zu verschieben oder zu verlängern.',
      'Nutze das Kontextmenü (Rechtsklick), um Duplikate oder Vorlagen anzulegen.'
    ]
  },
  'save': {
    title: 'Speichern & Vorschau',
    description: 'Speichere globale Änderungen oder Geräte-Overrides und aktualisiere anschließend die Vorschau.',
    steps: [
      'Der Button merkt sich, ob Änderungen offen sind (rotes Badge).',
      'Im Geräte-Kontext speicherst du nur das aktive Gerät – der Header zeigt den Kontext.'
    ]
  }
};

const TOUR_SEQUENCE = ['cockpit', 'view-menu', 'devices-panel', 'schedule', 'save'];

const STORAGE_KEYS = {
  seen: 'adminHelpSeen',
  tourCompleted: 'adminHelpTourCompleted'
};

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (typeof text === 'string') el.textContent = text;
  return el;
}

function buildList(items) {
  if (!items?.length) return null;
  const list = document.createElement('ul');
  list.className = 'context-help-list';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
  return list;
}

function positionPopover(popover, anchor) {
  const rect = anchor.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  const margin = 12;
  let top = rect.bottom + margin + window.scrollY;
  let left = rect.left + window.scrollX;
  if (left + popRect.width > window.scrollX + window.innerWidth - margin) {
    left = window.scrollX + window.innerWidth - popRect.width - margin;
  }
  if (left < margin) left = margin;
  if (top + popRect.height > window.scrollY + window.innerHeight - margin) {
    top = rect.top + window.scrollY - popRect.height - margin;
  }
  if (top < margin + window.scrollY) top = rect.top + window.scrollY + margin;
  popover.style.top = `${Math.max(margin, top)}px`;
  popover.style.left = `${Math.max(margin, left)}px`;
}

function markAsSeen(storage, seenSet, key) {
  if (seenSet.has(key)) return;
  seenSet.add(key);
  try {
    storage.set(STORAGE_KEYS.seen, JSON.stringify(Array.from(seenSet)));
  } catch {}
}

function restoreSeen(storage) {
  try {
    const raw = storage.get(STORAGE_KEYS.seen);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {}
  return new Set();
}

function setTourCompleted(storage) {
  try {
    storage.set(STORAGE_KEYS.tourCompleted, '1');
  } catch {}
}

function hasCompletedTour(storage) {
  try {
    return storage.get(STORAGE_KEYS.tourCompleted) === '1';
  } catch {
    return false;
  }
}

function buildPopover() {
  const container = createElement('div', 'context-help-popover');
  container.hidden = true;
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-modal', 'false');

  const closeBtn = createElement('button', 'context-help-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Hilfe schließen');
  container.appendChild(closeBtn);

  const title = createElement('h3', 'context-help-title');
  container.appendChild(title);

  const description = createElement('p', 'context-help-description');
  container.appendChild(description);

  const listHost = createElement('div', 'context-help-steps');
  container.appendChild(listHost);

  const footer = createElement('div', 'context-help-footer');
  const prevBtn = createElement('button', 'btn ghost sm', 'Zurück');
  prevBtn.type = 'button';
  prevBtn.dataset.action = 'prev';
  const nextBtn = createElement('button', 'btn primary sm', 'Weiter');
  nextBtn.type = 'button';
  nextBtn.dataset.action = 'next';
  footer.appendChild(prevBtn);
  footer.appendChild(nextBtn);
  container.appendChild(footer);

  return { container, closeBtn, title, description, listHost, footer, prevBtn, nextBtn };
}

/**
 * Initialises contextual help triggers.
 *
 * @param {{ storage: { get: (key: string) => (string|null), set: (key: string, value: string) => void } }} deps
 */
export function initContextHelp(deps) {
  const storage = deps?.storage;
  if (!storage) return;

  const anchors = Array.from(document.querySelectorAll('[data-help-key]'));
  if (!anchors.length) return;

  const seenTopics = restoreSeen(storage);
  const { container, closeBtn, title, description, listHost, prevBtn, nextBtn } = buildPopover();
  let currentKey = null;
  let tourIndex = -1;
  let activeAnchor = null;

  const hidePopover = () => {
    container.hidden = true;
    container.removeAttribute('data-tour');
    activeAnchor?.classList.remove('help-active');
    activeAnchor = null;
  };

  const renderTopic = (key) => {
    const topic = HELP_TOPICS[key];
    if (!topic) return;
    title.textContent = topic.title;
    description.textContent = topic.description;
    listHost.innerHTML = '';
    const list = buildList(topic.steps);
    if (list) listHost.appendChild(list);
  };

  const showPopover = (anchor, key, { tour = false } = {}) => {
    const topic = HELP_TOPICS[key];
    if (!topic || !anchor) return;
    renderTopic(key);
    container.hidden = false;
    container.dataset.topic = key;
    if (tour) {
      container.dataset.tour = '1';
      prevBtn.hidden = false;
      nextBtn.hidden = false;
    } else {
      container.removeAttribute('data-tour');
      prevBtn.hidden = true;
      nextBtn.hidden = false;
    }
    activeAnchor?.classList.remove('help-active');
    activeAnchor = anchor;
    activeAnchor.classList.add('help-active');
    positionPopover(container, anchor);
    markAsSeen(storage, seenTopics, key);
    currentKey = key;
    prevBtn.disabled = tourIndex <= 0;
    nextBtn.textContent = tour ? (tourIndex >= TOUR_SEQUENCE.length - 1 ? 'Fertig' : 'Weiter') : 'Schließen';
  };

  const stopTour = () => {
    tourIndex = -1;
    hidePopover();
    setTourCompleted(storage);
  };

  const showNextTourStep = (direction) => {
    if (tourIndex < 0) return;
    tourIndex += direction;
    if (tourIndex < 0) tourIndex = 0;
    if (tourIndex >= TOUR_SEQUENCE.length) {
      stopTour();
      return;
    }
    const key = TOUR_SEQUENCE[tourIndex];
    const anchor = anchors.find((node) => node.dataset.helpKey === key);
    if (!anchor) {
      stopTour();
      return;
    }
    showPopover(anchor, key, { tour: true });
  };

  const startTour = () => {
    tourIndex = 0;
    showNextTourStep(0);
  };

  closeBtn.addEventListener('click', () => {
    if (tourIndex >= 0) {
      stopTour();
    } else {
      hidePopover();
    }
  });

  prevBtn.addEventListener('click', () => showNextTourStep(-1));
  nextBtn.addEventListener('click', () => {
    if (tourIndex >= 0) {
      showNextTourStep(1);
    } else {
      hidePopover();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !container.hidden) {
      event.preventDefault();
      if (tourIndex >= 0) {
        stopTour();
      } else {
        hidePopover();
      }
    }
  });

  document.addEventListener('click', (event) => {
    if (container.hidden) return;
    if (container.contains(event.target)) return;
    if (activeAnchor?.contains(event.target)) return;
    if (tourIndex >= 0) return;
    hidePopover();
  });

  anchors.forEach((anchor) => {
    const key = anchor.dataset.helpKey;
    if (!HELP_TOPICS[key]) return;
    anchor.classList.add('has-help');
    const trigger = createElement('button', 'help-trigger', '?');
    trigger.type = 'button';
    trigger.setAttribute('aria-label', `${HELP_TOPICS[key].title} – Hilfe öffnen`);
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      if (currentKey === key && !container.hidden && tourIndex < 0) {
        hidePopover();
        return;
      }
      showPopover(anchor, key);
    });
    anchor.appendChild(trigger);
  });

  document.body.appendChild(container);

  if (!hasCompletedTour(storage)) {
    window.setTimeout(() => startTour(), 1200);
  }
}

export default initContextHelp;
