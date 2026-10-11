// Executado antes do React: evita o "flash" de tema claro no dark mode.
(function () {
  try {
    var salvo = localStorage.getItem('turbo-mais:tema');
    var escuro = salvo ? salvo === 'escuro' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (escuro) document.documentElement.classList.add('dark');
  } catch {
    /* localStorage bloqueado: segue no tema claro */
  }
})();
