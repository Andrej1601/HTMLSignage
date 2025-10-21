export function initSidebarResize({ lsGet, lsSet }) {
  const resizer = document.getElementById('layoutResizer');
  const rightbar = document.querySelector('.rightbar');
  if (!resizer || !rightbar) return;

  const root = document.documentElement;
  const getNumberVar = (name, fallback) => {
    const raw = getComputedStyle(root).getPropertyValue(name);
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : fallback;
  };

  let minPx = 0;
  let maxPx = 0;
  let hitPx = 0;
  const clampWidth = (value) => Math.min(maxPx, Math.max(minPx, value));
  const media = window.matchMedia('(orientation: portrait),(max-width: 900px)');

  const refreshBounds = () => {
    minPx = getNumberVar('--sidebar-min', 280);
    maxPx = getNumberVar('--sidebar-max', 920);
    hitPx = Math.max(4, getNumberVar('--sidebar-resizer-hit', 18));
  };
  refreshBounds();

  const readStoredWidth = () => {
    const stored = Number.parseFloat(lsGet('sidebarWidthPx'));
    return Number.isFinite(stored) ? clampWidth(stored) : null;
  };

  const updateAria = (width) => {
    const current = Number.isFinite(width) ? width : rightbar.getBoundingClientRect().width;
    resizer.setAttribute('aria-valuemin', String(Math.round(minPx)));
    resizer.setAttribute('aria-valuemax', String(Math.round(maxPx)));
    resizer.setAttribute('aria-valuenow', String(Math.round(current)));
  };

  const applyWidth = (width, { store = true } = {}) => {
    const clamped = clampWidth(width);
    root.style.setProperty('--sidebar-size', `${clamped}px`);
    updateAria(clamped);
    if (store) lsSet('sidebarWidthPx', String(Math.round(clamped)));
  };

  const resetWidth = () => {
    root.style.removeProperty('--sidebar-size');
    updateAria();
  };

  const isCollapsed = () => media.matches;

  const syncState = () => {
    if (isCollapsed()) {
      resizer.setAttribute('aria-hidden', 'true');
      resizer.setAttribute('tabindex', '-1');
      resizer.classList.remove('is-active');
      rightbar.classList.remove('resize-hover');
      resetWidth();
      return;
    }
    resizer.setAttribute('aria-hidden', 'false');
    resizer.setAttribute('tabindex', '0');
    refreshBounds();
    const stored = readStoredWidth();
    if (stored != null) {
      applyWidth(stored, { store: false });
    } else {
      resetWidth();
    }
  };

  media.addEventListener('change', syncState);
  window.addEventListener('resize', () => {
    refreshBounds();
    if (!isCollapsed()) updateAria();
  });

  const dragState = { active: false, pointerId: null, startX: 0, startWidth: 0, captureTarget: null };

  const handlePointerMove = (ev) => {
    if (!dragState.active || ev.pointerId !== dragState.pointerId) return;
    const delta = ev.clientX - dragState.startX;
    applyWidth(dragState.startWidth - delta, { store: false });
  };

  const finishDrag = (store = true) => {
    if (!dragState.active) return;
    dragState.active = false;
    const width = rightbar.getBoundingClientRect().width;
    if (store) applyWidth(width);
    const target = dragState.captureTarget;
    dragState.captureTarget = null;
    try {
      if (target && dragState.pointerId !== null) target.releasePointerCapture(dragState.pointerId);
    } catch {}
    dragState.pointerId = null;
    resizer.classList.remove('is-active');
    rightbar.classList.remove('resize-hover');
  };

  const tryStartDrag = (target, ev) => {
    if (!ev.isPrimary || isCollapsed()) return false;
    dragState.active = true;
    dragState.pointerId = ev.pointerId;
    dragState.startX = ev.clientX;
    dragState.startWidth = rightbar.getBoundingClientRect().width;
    dragState.captureTarget = target;
    try { target.setPointerCapture(ev.pointerId); } catch {}
    resizer.classList.add('is-active');
    ev.preventDefault();
    ev.stopPropagation();
    return true;
  };

  resizer.addEventListener('pointerdown', (ev) => {
    tryStartDrag(resizer, ev);
  });

  rightbar.addEventListener('pointerdown', (ev) => {
    if (dragState.active || !ev.isPrimary || isCollapsed()) return;
    const rect = rightbar.getBoundingClientRect();
    if ((ev.clientX - rect.left) > hitPx) return;
    tryStartDrag(rightbar, ev);
  });

  rightbar.addEventListener('pointermove', (ev) => {
    if (dragState.active || isCollapsed()) return;
    const rect = rightbar.getBoundingClientRect();
    const nearEdge = (ev.clientX - rect.left) <= hitPx;
    rightbar.classList.toggle('resize-hover', nearEdge);
  });
  rightbar.addEventListener('pointerleave', () => {
    if (!dragState.active) rightbar.classList.remove('resize-hover');
  });

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', (ev) => {
    if (ev.pointerId === dragState.pointerId) finishDrag(true);
  });
  window.addEventListener('pointercancel', (ev) => {
    if (ev.pointerId === dragState.pointerId) finishDrag(false);
  });
  resizer.addEventListener('lostpointercapture', () => finishDrag(false));
  rightbar.addEventListener('lostpointercapture', () => finishDrag(false));

  resizer.addEventListener('keydown', (ev) => {
    if (isCollapsed()) return;
    const baseWidth = rightbar.getBoundingClientRect().width;
    const step = ev.shiftKey ? 48 : 24;
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      applyWidth(baseWidth + step);
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      applyWidth(baseWidth - step);
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      applyWidth(minPx);
    } else if (ev.key === 'End') {
      ev.preventDefault();
      applyWidth(maxPx);
    }
  });

  syncState();
}
