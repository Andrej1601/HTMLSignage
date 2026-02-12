// /admin/js/core/notifications.js
// -----------------------------------------------------------------------------
// Kleine Benachrichtigungs-Helfer (Toast-Notifications) für Erfolg/Warnung/Fehler
// -----------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 6000;
const MAX_ACTIVE_NOTIFICATIONS = 3;
const ROLE_BY_TYPE = {
  success: 'status',
  info: 'status',
  warning: 'alert',
  error: 'alert'
};

let hostElement = null;
let activeNotifications = [];
let pendingNotifications = [];

function ensureHost(doc = document) {
  if (hostElement && hostElement.ownerDocument === doc) {
    return hostElement;
  }
  const host = doc.createElement('div');
  host.className = 'notify-host';
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-atomic', 'false');
  doc.body.appendChild(host);
  hostElement = host;
  return host;
}

function normalizeOptions(messageOrOptions, maybeOptions) {
  if (typeof messageOrOptions === 'string') {
    return { ...maybeOptions, message: messageOrOptions };
  }
  if (messageOrOptions && typeof messageOrOptions === 'object') {
    return { ...messageOrOptions };
  }
  return { ...maybeOptions };
}

function dismissNotification(element) {
  if (!element || !element.isConnected) return;
  element.classList.remove('show');
  element.classList.add('hide');
  const remove = () => {
    element.removeEventListener('transitionend', remove);
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  };
  element.addEventListener('transitionend', remove);
  setTimeout(remove, 400);
}

function enqueueNotification(request) {
  pendingNotifications.push(request);
}

function dequeueNotification() {
  if (pendingNotifications.length === 0) return;
  const next = pendingNotifications.shift();
  if (next) {
    next();
  }
}

function registerNotificationHandle(handle) {
  activeNotifications.push(handle);
}

function unregisterNotificationHandle(handle) {
  activeNotifications = activeNotifications.filter((item) => item !== handle);
  if (activeNotifications.length < MAX_ACTIVE_NOTIFICATIONS) {
    dequeueNotification();
  }
}

function createNotification(normalized) {
  const { document: customDocument, type = 'info' } = normalized;
  const doc = customDocument || document;
  const host = ensureHost(doc);

  const level = (typeof type === 'string') ? type.toLowerCase() : 'info';
  const role = ROLE_BY_TYPE[level] || 'status';

  const el = doc.createElement('div');
  el.className = `notify-item notify-${level}`;
  el.setAttribute('role', role);

  const body = doc.createElement('div');
  body.className = 'notify-body';

  const title = doc.createElement('div');
  title.className = 'notify-title';
  title.textContent = normalized.message || '';
  body.appendChild(title);

  if (normalized.description) {
    const desc = doc.createElement('div');
    desc.className = 'notify-description';
    desc.textContent = normalized.description;
    body.appendChild(desc);
  }

  if (Array.isArray(normalized.actions)) {
    const actionsWrap = doc.createElement('div');
    actionsWrap.className = 'notify-actions';
    normalized.actions.forEach((action) => {
      if (!action || typeof action !== 'object' || !action.label) return;
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'notify-action';
      btn.textContent = action.label;
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (typeof action.onClick === 'function') {
          action.onClick({ dismiss: () => dismissNotification(el) });
        }
      });
      actionsWrap.appendChild(btn);
    });
    if (actionsWrap.children.length) {
      body.appendChild(actionsWrap);
    }
  }

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'notify-close';
  closeBtn.setAttribute('aria-label', 'Benachrichtigung schließen');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    dismissNotification(el);
  });

  el.appendChild(body);
  el.appendChild(closeBtn);
  host.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add('show');
  });

  let timer = null;
  const timeout = Number.isFinite(normalized.timeout) ? Number(normalized.timeout) : DEFAULT_TIMEOUT;
  if (!normalized.persistent) {
    timer = setTimeout(() => dismissNotification(el), Math.max(1500, timeout));
  }

  const handle = {
    element: el,
    dismiss: () => {
      if (timer) clearTimeout(timer);
      dismissNotification(el);
    }
  };

  const cleanup = () => unregisterNotificationHandle(handle);
  el.addEventListener('transitionend', cleanup);
  return handle;
}

export function notify(options, extraOptions) {
  const normalized = normalizeOptions(options, extraOptions);
  if (normalized.type === 'error' && normalized.persistent === undefined && normalized.timeout === undefined) {
    normalized.persistent = true;
  }

  if (activeNotifications.length >= MAX_ACTIVE_NOTIFICATIONS) {
    let queuedHandle = null;
    const run = () => {
      queuedHandle = createNotification(normalized);
      registerNotificationHandle(queuedHandle);
    };
    enqueueNotification(run);
    return {
      element: null,
      dismiss: () => {
        if (!queuedHandle) {
          pendingNotifications = pendingNotifications.filter((item) => item !== run);
          return;
        }
        queuedHandle.dismiss();
      }
    };
  }

  const handle = createNotification(normalized);
  registerNotificationHandle(handle);
  return handle;
}

export function notifySuccess(message, options) {
  return notify({ ...normalizeOptions(message, options), type: 'success' });
}

export function notifyInfo(message, options) {
  return notify({ ...normalizeOptions(message, options), type: 'info' });
}

export function notifyWarning(message, options) {
  return notify({ ...normalizeOptions(message, options), type: 'warning' });
}

export function notifyError(message, options) {
  return notify({ ...normalizeOptions(message, options), type: 'error' });
}

export default notify;
