// src/home.js
import { setActivePage, toggleBolinha } from './global.js';  // ← IMPORTAR toggleBolinha

let enviandoSala = false;

document.addEventListener('DOMContentLoaded', () => {
  setActivePage();
  carregarEstatisticasDashboard();
});

// === ESTATÍSTICAS DO DASHBOARD ===
async function carregarEstatisticasDashboard() {
  const container = document.getElementById('salas-disponiveis');
  if (!container) return;

  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error();
    const data = await res.json();

    const update = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    update('salas-disponiveis', data.salasDisponiveis);
    update('labs-disponiveis', data.labsDisponiveis);
    update('reservas-ativas', data.reservasAtivas);
    update('devolucoes-pendentes', data.devolucoesPendentes);
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

// === MODAL ADICIONAR SALA ===
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

async function carregarOpcoesFiltros() {
  try {
    const res = await fetch('/api/salas/opcoes');
    if (!res.ok) throw new Error();
    const { localizacoes, tipos } = await res.json();

    const fillSelect = (id, items) => {
      const select = document.getElementById(id);
      if (select) {
        select.innerHTML = '<option value="">Escolha</option>';
        items.forEach(item => select.appendChild(new Option(item, item)));
      }
    };

    fillSelect('novo-localizacao', localizacoes);
    fillSelect('novo-tipo', tipos);
  } catch (err) {
    console.error('Erro ao carregar opções de filtro:', err);
    alert('Erro ao carregar opções.');
  }
}

async function adicionarSala() {
  if (enviandoSala) return;
  enviandoSala = true;

  const btn = document.getElementById('btn-acao-sala');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Enviando...';
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
      carregarEstatisticasDashboard();
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

// EXPOR FUNÇÕES PARA O HTML (OBRIGATÓRIO!)
window.abrirModalAdicionar = abrirModalAdicionar;
window.fecharModalAdicionar = fecharModalAdicionar;
window.toggleBolinha = toggleBolinha;  // ← VEM DO global.js