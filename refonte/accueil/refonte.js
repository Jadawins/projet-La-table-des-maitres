// Remplacer l’ancien cache applicatif sans toucher aux données locales des personnages.
if(new URLSearchParams(location.search).has('code'))location.replace('/connexion.html'+location.search);
if (location.hostname === 'myrpgtable.fr' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js', {updateViaCache:'none'})
    .then(registration => registration.update()).catch(() => {});
}
