function togglePwd(btn) {
  const input = btn.closest('.pwd-wrapper').querySelector('input');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.classList.toggle('active', !showing);
}
