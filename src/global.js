// src/global.js

// === FUNÇÃO GLOBAL: ativa link no menu ===
export function setActivePage() {
  const current = window.location.pathname.split('/').pop() || 'home';
  document.querySelectorAll('.paginas a').forEach(link => {
    link.classList.toggle('active', link.dataset.page === current);
  });
}

// === FUNÇÃO GLOBAL: bolinha checkbox (home) ===
export function toggleBolinha(element) {
  element.classList.toggle('preenchida');
}

// === FUNÇÃO GLOBAL: preview de imagem (home) ===
export function previewImagem(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('preview-imagem');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = (e) => preview.src = e.target.result;
    reader.readAsDataURL(file);
  }
}

// === DOMContentLoaded: SÓ FUNÇÕES GLOBAIS ===
document.addEventListener('DOMContentLoaded', () => {
  setActivePage(); // Sempre ativa a página correta
  // NÃO CHAMA NADA DO RELATÓRIO AQUI
});