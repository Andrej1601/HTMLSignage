'use strict';

function initSidebarToggle() {
  const shell = document.querySelector('.admin-shell');
  const toggle = document.getElementById('navToggle');
  const overlay = document.querySelector('[data-role="sidebar-overlay"]');
  if (!shell || !toggle) return;

  const updateExpanded = () => {
    const expanded = shell.classList.contains('sidebar-open');
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };

  const closeSidebar = () => {
    shell.classList.remove('sidebar-open');
    updateExpanded();
  };

  const openSidebar = () => {
    shell.classList.add('sidebar-open');
    updateExpanded();
  };

  toggle.addEventListener('click', () => {
    if (shell.classList.contains('sidebar-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay?.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });

  const autoClose = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 1024px)') : null;
  if (autoClose && typeof autoClose.addEventListener === 'function') {
    autoClose.addEventListener('change', (event) => {
      if (!event.matches) closeSidebar();
    });
  }

  const shouldAutoClose = () => Boolean(autoClose?.matches);

  shell.querySelectorAll('.sidebar-submenu-btn').forEach((button) => {
    button.addEventListener('click', () => {
      if (shouldAutoClose()) closeSidebar();
    });
  });

  updateExpanded();
}

function ensureDetailsOpen(element) {
  if (!element) return;
  if (element.matches('details')) {
    element.open = true;
  }
  let parent = element.closest('details');
  while (parent) {
    parent.open = true;
    parent = parent.parentElement?.closest('details');
  }
}

function getScrollTarget(element) {
  if (!element) return null;
  if (element.hasAttribute('data-jump-target')) {
    return element;
  }
  return element.closest('[data-jump-target]') || element;
}

function highlight(element) {
  if (!element) return;
  element.classList.remove('jump-flash');
  void element.offsetWidth;
  element.classList.add('jump-flash');
  window.setTimeout(() => element.classList.remove('jump-flash'), 1600);
}

function canFocus(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.tabIndex >= 0) return true;
  return /^(A|BUTTON|SUMMARY|INPUT|SELECT|TEXTAREA)$/i.test(element.tagName);
}

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function waitForElement(selector, attempts = 6) {
  if (!selector) return null;
  const existing = document.querySelector(selector);
  if (existing) return existing;
  if (attempts <= 0) return null;
  await sleep(120);
  return waitForElement(selector, attempts - 1);
}

function initShellMenu() {
  const menu = document.querySelector('[data-shell-menu]');
  const panelsHost = document.getElementById('workspacePanels');
  if (!menu || !panelsHost) return;

  const panels = Array.from(panelsHost.querySelectorAll('.workspace-panel'));
  const panelLookup = new Map(panels.map((panel) => [panel.dataset.panel, panel]));
  let activeButton = null;

  const setActiveButton = (button) => {
    if (activeButton) activeButton.classList.remove('is-active');
    activeButton = button || null;
    if (activeButton) activeButton.classList.add('is-active');
  };

  const setActivePanel = (panelId) => {
    if (!panelLookup.has(panelId)) return false;
    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panel === panelId);
    });
    return true;
  };

  const revealGroupForPanel = (panelId) => {
    const button = menu.querySelector(`.sidebar-submenu-btn[data-panel="${panelId}"]`);
    if (!button) return;
    const group = button.closest('[data-shell-group]');
    if (!group) return;
    group.classList.add('is-open');
    const trigger = group.querySelector('[data-shell-trigger]');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  };

  const showPanel = async ({ panel, focus, button }) => {
    if (!panel) return;
    if (!setActivePanel(panel)) return;
    setActiveButton(button || menu.querySelector(`.sidebar-submenu-btn[data-panel="${panel}"]`));
    revealGroupForPanel(panel);

    if (!focus) return;
    const target = await waitForElement(focus);
    if (!target) return;
    ensureDetailsOpen(target);
    const scrollTarget = getScrollTarget(target);
    window.requestAnimationFrame(() => {
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const highlightEl = target.matches('details')
        ? target.querySelector(':scope > summary') || scrollTarget
        : scrollTarget;
      highlight(highlightEl);
      if (highlightEl && typeof highlightEl.focus === 'function' && canFocus(highlightEl)) {
        highlightEl.focus({ preventScroll: true });
      }
    });
  };

  menu.querySelectorAll('[data-shell-trigger]').forEach((trigger) => {
    const group = trigger.closest('[data-shell-group]');
    if (!group) return;
    trigger.setAttribute('aria-expanded', group.classList.contains('is-open') ? 'true' : 'false');
    trigger.addEventListener('click', () => {
      const expanded = !group.classList.contains('is-open');
      group.classList.toggle('is-open', expanded);
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  });

  menu.querySelectorAll('.sidebar-submenu-btn').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async () => {
      const panel = buttonEl.dataset.panel;
      const focus = buttonEl.dataset.focus;
      await showPanel({ panel, focus, button: buttonEl });
    });
  });

  document.addEventListener('shell:show-panel', async (event) => {
    const detail = event?.detail || {};
    await showPanel({ panel: detail.panel, focus: detail.focus || null, button: null });
  });

  const defaultButton = menu.querySelector('.sidebar-submenu-btn[data-panel="planning"]')
    || menu.querySelector('.sidebar-submenu-btn');
  if (defaultButton) {
    const defaultGroup = defaultButton.closest('[data-shell-group]');
    if (defaultGroup) {
      defaultGroup.classList.add('is-open');
      const trigger = defaultGroup.querySelector('[data-shell-trigger]');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
    }
    showPanel({
      panel: defaultButton.dataset.panel,
      focus: defaultButton.dataset.focus || null,
      button: defaultButton
    });
  }
}

export function initShell() {
  initSidebarToggle();
  initShellMenu();
}

export default initShell;
