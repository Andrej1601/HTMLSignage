async function fetchToken(){
  const r = await fetch('api/login.php?token=1', {credentials: 'include'});
  if(r.ok){
    const data = await r.json();
    document.getElementById('token').value = data.token;
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = new URLSearchParams();
  body.set('username', document.getElementById('username').value);
  body.set('password', document.getElementById('password').value);
  body.set('token', document.getElementById('token').value);
  const r = await fetch('api/login.php', {
    method: 'POST',
    body,
    credentials: 'include',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
  });
  if(r.ok){
    window.location.href = '/admin/';
  } else {
    document.getElementById('error').textContent = 'Login fehlgeschlagen';
    fetchToken();
  }
});

fetchToken();
