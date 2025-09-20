// /admin/js/core/upload.js
// Minimaler, wiederverwendbarer Uploader (wie dein bisheriger uploadGeneric)

export async function uploadGeneric(fileInput, onDone, thumbInput){
  if(!fileInput.files || !fileInput.files[0]) return;
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  if (thumbInput && thumbInput.files && thumbInput.files[0]) {
    fd.append('thumb', thumbInput.files[0]);
  }

  try {
    const r = await fetch('/admin/api/upload.php', {
      method: 'POST',
      body: fd
    });
    const j = await r.json();
    if (j.ok) onDone(j.path, j.thumb);
    else alert('Upload-Fehler');
  } catch {
    alert('Upload fehlgeschlagen');
  }
}

// Direkter Upload von File-Objekten (z.B. aus WYSIWYG-Editoren)
export async function uploadFile(file, onDone){
  if(!file) return;
  const fd = new FormData();
  fd.append('file', file);

  try {
    const r = await fetch('/admin/api/upload.php', {
      method: 'POST',
      body: fd
    });
    const j = await r.json();
    if (j.ok) onDone(j.path, j.thumb);
    else alert('Upload-Fehler');
  } catch {
    alert('Upload fehlgeschlagen');
  }
}
