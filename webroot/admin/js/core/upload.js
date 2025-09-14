// /admin/js/core/upload.js
// Minimaler, wiederverwendbarer Uploader (wie dein bisheriger uploadGeneric)

export function uploadGeneric(fileInput, onDone, thumbInput){
  if(!fileInput.files || !fileInput.files[0]) return;
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  if (thumbInput && thumbInput.files && thumbInput.files[0]) {
    fd.append('thumb', thumbInput.files[0]);
  }

  const xhr = new XMLHttpRequest();
  xhr.open('POST','/admin/api/upload.php');
  xhr.onload = () => {
    try{
      const j = JSON.parse(xhr.responseText||'{}');
      if (j.ok) onDone(j.path, j.thumb);
      else alert('Upload-Fehler');
    }catch{
      alert('Upload fehlgeschlagen');
    }
  };
  xhr.onerror = () => alert('Netzwerkfehler beim Upload');
  xhr.send(fd);
}

// Direkter Upload von File-Objekten (z.B. aus WYSIWYG-Editoren)
export function uploadFile(file, onDone){
  if(!file) return;
  const fd = new FormData();
  fd.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST','/admin/api/upload.php');
  xhr.onload = () => {
    try{
      const j = JSON.parse(xhr.responseText||'{}');
      if (j.ok) onDone(j.path, j.thumb);
      else alert('Upload-Fehler');
    }catch{
      alert('Upload fehlgeschlagen');
    }
  };
  xhr.onerror = () => alert('Netzwerkfehler beim Upload');
  xhr.send(fd);
}
