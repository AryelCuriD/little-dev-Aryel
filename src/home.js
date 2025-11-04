
import { setActivePage, toggleBolinha } from './global.js';

// === VARIÁVEIS GLOBAIS ===
let enviandoSala = false;
let ultimaAtualizacao = 0;

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', () => {
  setActivePage();
  carregarDashboard();

  // Atualiza a cada 30 segundos (backup)
  setInterval(carregarDashboard, 30000);

  // Escuta mudanças em tempo real via localStorage
  window.addEventListener('storage', (e) => {
    if (e.key === 'atualizar_dashboard' && e.newValue) {
      const timestamp = parseInt(e.newValue);
      if (timestamp > ultimaAtualizacao) {
        ultimaAtualizacao = timestamp;
        carregarDashboard();
      }
    }
  });

  // Verifica novas reservas a cada 5 segundos
  setInterval(() => {
    verificarNovasReservas();
  }, 5000);
});

// === VERIFICA NOVAS RESERVAS (sem recarregar tudo) ===
async function verificarNovasReservas() {
  try {
    const res = await fetch('/api/reservas/proximas');
    if (!res.ok) return;
    const novas = await res.json();
    if (novas.length > 0) {
      const ultima = novas[0].id;
      if (ultima > ultimaAtualizacao) {
        ultimaAtualizacao = ultima;
        localStorage.setItem('atualizar_dashboard', ultima);
        carregarDashboard();
      }
    }
  } catch (err) {
    // Silencioso
  }
}

// === CARREGA DASHBOARD COMPLETO ===
async function carregarDashboard() {
  try {
    const [dashRes, proxRes] = await Promise.all([
      fetch('/api/dashboard').then(r => r.ok ? r.json() : { 
        salasDisponiveis: 0, 
        labsDisponiveis: 0, 
        reservasAtivas: 0, 
        devolucoesPendentes: 0 
      }),
      fetch('/api/reservas/proximas').then(r => r.ok ? r.json() : [])
    ]);

    atualizarDashboard(dashRes, proxRes);
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

// === ATUALIZA A INTERFACE ===
function atualizarDashboard(dashboard, proximasReservas) {
  const update = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '--';
  };

  update('salas-disponiveis', dashboard.salasDisponiveis);
  update('labs-disponiveis', dashboard.labsDisponiveis);
  update('reservas-ativas', dashboard.reservasAtivas);
  update('devolucoes-pendentes', dashboard.devolucoesPendentes);

  renderizarProximas(proximasReservas);
}

// === RENDERIZA PRÓXIMAS RESERVAS NA TABELA ===
function renderizarProximas(reservas) {
  const tbody = document.querySelector('#tabela-proximas tbody');
  const sem = document.getElementById('sem-reservas');

  if (!reservas || reservas.length === 0) {
    if (sem) sem.style.display = 'block';
    if (tbody) tbody.innerHTML = '';
    return;
  }

  if (sem) sem.style.display = 'none';
  if (!tbody) return;

  tbody.innerHTML = reservas.map(r => `
    <tr>
      <td class="sala">Sala ${r.numero_sala}</td>
      <td>${r.solicitante}</td>
      <td class="horario">${r.horario_completo}</td>
    </tr>
  `).join('');
}

// === MODAL: ADICIONAR SALA ===
function abrirModalAdicionar() {
  resetModalAdicionar();
  document.getElementById('modal-titulo-sala').textContent = 'Adicionar Nova Sala';
  document.getElementById('btn-acao-sala').textContent = 'Adicionar Sala';
  document.getElementById('btn-acao-sala').onclick = adicionarSala;
  
  carregarOpcoesFiltros().then(() => {
    document.getElementById('modal-adicionar-sala').style.display = 'flex';
  });
}

function fecharModalAdicionar() {
  document.getElementById('modal-adicionar-sala').style.display = 'none';
  resetModalAdicionar();
}

function resetModalAdicionar() {
  document.getElementById('novo-numero').value = '';
  document.getElementById('novo-capacidade').value = '';
  document.getElementById('novo-localizacao').value = '';
  document.getElementById('novo-tipo').value = '';
  document.getElementById('upload-imagem').value = '';
  document.getElementById('preview-imagem').src = './imgs/plus-photo.png';
  
  ['check-projetor', 'check-ar', 'check-tv', 'check-pc'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('preenchida');
  });
}

// === CARREGA OPÇÕES PARA SELECTS (tipo, localização) ===
async function carregarOpcoesFiltros() {
  try {
    const res = await fetch('/api/salas/opcoes');
    if (!res.ok) throw new Error();
    const { localizacoes, tipos } = await res.json();
    preencherSelects(localizacoes, tipos);
  } catch {
    // Fallback local
    const localizacoes = ['Térreo', '1º Andar', '2º Andar'];
    const tipos = ['Sala de Aula', 'Laboratório de Informática', 'Laboratório de Eletrônica'];
    preencherSelects(localizacoes, tipos);
  }
}

function preencherSelects(localizacoes, tipos) {
  const fill = (id, items) => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = '<option value="">Escolha</option>';
      items.forEach(item => select.appendChild(new Option(item, item)));
    }
  };
  fill('novo-localizacao', localizacoes);
  fill('novo-tipo', tipos);
}

// === ENVIA NOVA SALA PARA O BACKEND ===
async function adicionarSala() {
  if (enviandoSala) return;
  enviandoSala = true;

  const btn = document.getElementById('btn-acao-sala');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Adicionando...';
  btn.disabled = true;

  const numero = document.getElementById('novo-numero').value.trim();
  const capacidade = document.getElementById('novo-capacidade').value;
  const localizacao = document.getElementById('novo-localizacao').value;
  const tipo = document.getElementById('novo-tipo').value;
  const file = document.getElementById('upload-imagem').files[0];

  const projetor = document.getElementById('check-projetor').classList.contains('preenchida');
  const ar = document.getElementById('check-ar').classList.contains('preenchida');
  const tv = document.getElementById('check-tv').classList.contains('preenchida');
  const pc = document.getElementById('check-pc').classList.contains('preenchida');

  if (!numero || !capacidade || !localizacao || !tipo) {
    alert('Preencha todos os campos obrigatórios!');
    btn.textContent = textoOriginal;
    btn.disabled = false;
    enviandoSala = false;
    return;
  }

  const formData = new FormData();
  formData.append('numero_sala', numero);
  formData.append('tipo_sala', tipo);
  formData.append('localizacao', localizacao);
  formData.append('capacidade', capacidade);
  formData.append('projetor', projetor);
  formData.append('ar_condicionado', ar);
  formData.append('televisao', tv);
  formData.append('computador', pc);
  if (file) formData.append('imagem', file);

  try {
    const res = await fetch('/api/salas', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      alert('Sala adicionada com sucesso!');
      fecharModalAdicionar();
      carregarDashboard();
    } else {
      const erro = await res.text();
      alert('Erro: ' + erro);
    }
  } catch (err) {
    console.error('Erro de conexão:', err);
    alert('Erro de conexão.');
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
    enviandoSala = false;
  }
}

// === EXPOSIÇÃO GLOBAL DAS FUNÇÕES ===
window.abrirModalAdicionar = abrirModalAdicionar;
window.fecharModalAdicionar = fecharModalAdicionar;
window.toggleBolinha = toggleBolinha;