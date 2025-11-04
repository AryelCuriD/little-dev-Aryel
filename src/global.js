// === FUNÇÕES GLOBAIS ===
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
  if (!file || !preview) return;
  const reader = new FileReader();
  reader.onload = (e) => preview.src = e.target.result;
  reader.readAsDataURL(file);
}

export function initDarkMode() {
  const toggle = document.querySelector('#toggle-dark');
  const saved = localStorage.getItem('darkMode') === 'true';

  // APLICA EM TODAS AS PÁGINAS
  document.documentElement.classList.toggle('dark-mode', saved);

  if (toggle) {
    toggle.checked = saved;
    toggle.addEventListener('change', () => {
      const ativar = toggle.checked;
      document.documentElement.classList.toggle('dark-mode', ativar);
      localStorage.setItem('darkMode', ativar);
    });
  }
}

// === NOTIFICAÇÕES DINÂMICAS (100% JS) ===
let notificacoesPendentes = [];

// === SOM DE NOTIFICAÇÃO ===
const somNotificacao = new Audio('./sons/notification.mp3');
somNotificacao.preload = 'auto';

// === CRIA MODAL DINÂMICO (SÓ UMA VEZ) ===
function criarModalNotificacao() {
  const modal = document.createElement('div');
  modal.id = 'modal-notificacao';
  modal.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); z-index: 9999; justify-content: center; align-items: center;
    font-family: 'Open Sans', sans-serif;
  `;

  modal.innerHTML = `
    <div id="notificacao-conteudo" style="
      background: #1e1e1e; color: white; padding: 20px; border-radius: 12px;
      max-width: 380px; width: 90%; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.4);
      position: relative; animation: slideDown 0.3s ease;
    ">
      <button id="fechar-notificacao" style="
        position: absolute; top: 8px; right: 12px; background: none; border: none;
        color: #aaa; font-size: 20px; cursor: pointer; width: 30px; height: 30px;
        display: flex; align-items: center; justify-content: center;
      ">×</button>
      <h3 style="margin: 0 0 12px; color: #4ade80; font-size: 18px;">Reserva Finalizada!</h3>
      <p id="notificacao-mensagem" style="margin: 8px 0; font-size: 15px; line-height: 1.5;"></p>
    </div>
  `;

  document.body.appendChild(modal);

  // Fecha com X
  modal.querySelector('#fechar-notificacao').onclick = () => {
    modal.style.display = 'none';
    notificacoesPendentes = [];
    atualizarBadge(0);
  };

  return modal;
}

// === ANIMAÇÃO DE ENTRADA ===
const styleAnim = document.createElement('style');
styleAnim.textContent = `
  @keyframes slideDown {
    from { transform: translateY(-50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(styleAnim);

// === ABRIR MODAL ===
window.abrirNotificacoes = function() {
  let modal = document.getElementById('modal-notificacao');
  if (!modal) modal = criarModalNotificacao();

  const msgEl = modal.querySelector('#notificacao-mensagem');

  if (notificacoesPendentes.length === 0) {
    msgEl.textContent = 'Nenhuma notificação no momento.';
  } else {
    const ultima = notificacoesPendentes[notificacoesPendentes.length - 1];
    msgEl.textContent = `A reserva da ${ultima.sala} com ${ultima.solicitante} acabou.`;
    notificacoesPendentes = [];
    atualizarBadge(0);
  }

  modal.style.display = 'flex';
};

// === ATUALIZA BADGE NO SINO ===
function atualizarBadge(qtd) {
  let badge = document.getElementById('badge-notificacao');
  const sino = document.querySelector('.icons img[alt*="Notificação"], .icons img[src*="bell"]');

  if (!sino) return;

  if (qtd > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'badge-notificacao';
      badge.style.cssText = `
        position: absolute; top: -6px; right: -6px; background: #f87171; color: white;
        border-radius: 50%; width: 20px; height: 20px; font-size: 12px; font-weight: bold;
        display: flex; align-items: center; justify-content: center; z-index: 10;
      `;
      sino.style.position = 'relative';
      sino.parentElement.appendChild(badge);
    }
    badge.textContent = qtd;
  } else if (badge) {
    badge.remove();
  }
}

// === RECEBER NOTIFICAÇÃO ===
export function notificarFimReserva(sala, solicitante) {
  notificacoesPendentes.push({ sala, solicitante });
  somNotificacao.play().catch(() => {});
  atualizarBadge(notificacoesPendentes.length);
}

// === ESCUTA NOTIFICAÇÕES EM TEMPO REAL ===
window.addEventListener('storage', (e) => {
  if (e.key === 'notificacao_fim_reserva' && e.newValue) {
    const data = JSON.parse(e.newValue);
    notificarFimReserva(data.sala, data.solicitante);
  }
});

// === INICIALIZAÇÃO GLOBAL ===
document.addEventListener('DOMContentLoaded', () => {
  setActivePage();
  initDarkMode();
});