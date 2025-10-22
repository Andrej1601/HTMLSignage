export const SAUNA_STATUS = Object.freeze({
  ACTIVE: 'active',
  NO_INFUSIONS: 'no-infusions',
  OUT_OF_ORDER: 'out-of-order',
  HIDDEN: 'hidden'
});

export const SAUNA_STATUS_TEXT = {
  [SAUNA_STATUS.ACTIVE]: 'Aufgüsse',
  [SAUNA_STATUS.NO_INFUSIONS]: 'Keine Aufgüsse',
  [SAUNA_STATUS.OUT_OF_ORDER]: 'Außer Betrieb',
  [SAUNA_STATUS.HIDDEN]: 'Ausgeblendet'
};

export function normalizeSaunaStatus(value){
  if (typeof value !== 'string') return null;
  let key = value.trim();
  if (!key) return null;
  try { key = key.normalize('NFKD'); }
  catch (err) { /* ignore */ }
  key = key.replace(/ß/g, 'ss').replace(/[\u0300-\u036f]/g, '');
  key = key.toLowerCase().replace(/[_\s]+/g, '-');
  if (Object.values(SAUNA_STATUS).includes(key)) return key;
  if (key === 'keine-aufgusse' || key === 'kein-aufguss' || key === 'no-aufguss' || key === 'noaufguss' || key === 'noinfusions') {
    return SAUNA_STATUS.NO_INFUSIONS;
  }
  if (key === 'ausser-betrieb' || key === 'ausserbetrieb' || key === 'outoforder') {
    return SAUNA_STATUS.OUT_OF_ORDER;
  }
  if (key === 'ausgeblendet' || key === 'ausblenden') {
    return SAUNA_STATUS.HIDDEN;
  }
  return null;
}

export function computeSaunaStatusState(currentSettings, currentSchedule){
  const map = new Map();
  const hidden = new Set();
  const statusCfg = (currentSettings?.slides?.saunaStatus && typeof currentSettings.slides.saunaStatus === 'object')
    ? currentSettings.slides.saunaStatus
    : {};
  const legacyHidden = new Set(currentSettings?.slides?.hiddenSaunas || []);
  const saunas = Array.isArray(currentSchedule?.saunas) ? currentSchedule.saunas : [];
  const rows = Array.isArray(currentSchedule?.rows) ? currentSchedule.rows : [];
  saunas.forEach((name, idx) => {
    if (typeof name !== 'string' || !name) return;
    let status = normalizeSaunaStatus(statusCfg[name]);
    const hasEntries = rows.some(row => {
      const entries = Array.isArray(row?.entries) ? row.entries : [];
      const cell = entries[idx];
      return !!(cell && cell.title);
    });
    if (!status && legacyHidden.has(name)) status = SAUNA_STATUS.NO_INFUSIONS;
    if (!status) status = hasEntries ? SAUNA_STATUS.ACTIVE : SAUNA_STATUS.NO_INFUSIONS;
    if (status === SAUNA_STATUS.ACTIVE && !hasEntries) status = SAUNA_STATUS.NO_INFUSIONS;
    if (status === SAUNA_STATUS.NO_INFUSIONS && hasEntries) status = SAUNA_STATUS.ACTIVE;
    if (!SAUNA_STATUS_TEXT[status] && status !== SAUNA_STATUS.ACTIVE){
      status = hasEntries ? SAUNA_STATUS.ACTIVE : SAUNA_STATUS.NO_INFUSIONS;
    }
    map.set(name, status);
    if (status !== SAUNA_STATUS.ACTIVE) hidden.add(name);
  });
  return { map, hidden };
}
