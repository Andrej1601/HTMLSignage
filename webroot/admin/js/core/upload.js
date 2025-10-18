// /admin/js/core/upload.js
// Minimaler, wiederverwendbarer Uploader (wie dein bisheriger uploadGeneric)

import { fetchJson } from './utils.js';
import { notifyError } from './notifications.js';

export async function uploadGeneric(fileInput, onDone, thumbInput){
  if (!fileInput?.files || !fileInput.files[0]) return;
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  if (thumbInput?.files?.[0]) {
    fd.append('thumb', thumbInput.files[0]);
  }

  try {
    const result = await fetchJson('/admin/api/upload.php', {
      method: 'POST',
      body: fd,
      expectOk: true,
      errorMessage: 'Upload fehlgeschlagen.'
    });
    if (typeof onDone === 'function') {
      onDone(result?.path, result?.thumb);
    }
  } catch (error) {
    console.error('[admin] Upload fehlgeschlagen', error);
    notifyError(error.message || 'Upload fehlgeschlagen.');
  } finally {
    try { fileInput.value = ''; } catch {}
    if (thumbInput) {
      try { thumbInput.value = ''; } catch {}
    }
  }
}
