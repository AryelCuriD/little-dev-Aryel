// src/common.js
export function setActivePage() {
  const current = window.location.pathname.split('/').pop() || 'home';
  document.querySelectorAll('.paginas a').forEach(link => {
    link.classList.toggle('active', link.dataset.page === current);
  });
}

export function toggleBolinha(element) {
  element.classList.toggle('preenchida');
}

export function previewImagem(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('preview-imagem');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = (e) => preview.src = e.target.result;
    reader.readAsDataURL(file);
  }
}