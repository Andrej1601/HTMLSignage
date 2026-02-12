document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnHelp');
  const overlay = document.getElementById('helpOverlay');
  const close = document.getElementById('helpClose');
  if (!btn || !overlay || !close) return;
  const hide = () => { overlay.hidden = true; };
  btn.addEventListener('click', () => {
    overlay.hidden = false;
  });
  close.addEventListener('click', hide);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) hide();
  });
});
