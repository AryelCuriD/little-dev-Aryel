/**
 * script.js - Funções globais e específicas por página
 * ----------------------------------------------------
 * Organização:
 * 1. Navegação e UI Global
 * 2. Notificações
 * 3. Página de Usuário
 * 4. Dashboard (index.html)
 * 5. Reservas (reservas.html) ← TOTALMENTE CORRIGIDO
 */
let salas = [];
// ===============================================
// 1. NAVEGAÇÃO E UI GLOBAL
// ===============================================
function setActivePage() {
  const currentPage = window.location.pathname.split('/').pop() || 'home';
  document.querySelectorAll('.paginas a').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-page') === currentPage);
  });
}

function paginaUsuario() {
  window.location.href = '/usuario';
}

// Previne comportamento padrão dos links do footer
document.querySelectorAll('.paginas a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = link.getAttribute('href');
  });
});

// ===============================================
// 2. NOTIFICAÇÕES
// ===============================================
function abrirNotificacoes() {
  const overlay = document.getElementById('overlay');
  const notificacoes = document.getElementById('notificacoes');
  if (overlay && notificacoes) {
    overlay.style.display = 'block';
    notificacoes.style.display = 'block';
  }
}

function fecharNotificacoes() {
  const overlay = document.getElementById('overlay');
  const notificacoes = document.getElementById('notificacoes');
  if (overlay && notificacoes) {
    overlay.style.display = 'none';
    notificacoes.style.display = 'none';
  }
}

// ===============================================
// 3. PÁGINA DE USUÁRIO (troca de abas)
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
  const menuItems = document.querySelectorAll('.menu-item');
  if (menuItems.length === 0) return;

  const cards = document.querySelectorAll('.card-conteudo');

  menuItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('ativo'));
      cards.forEach(c => c.classList.remove('ativo'));
      item.classList.add('ativo');
      cards[index].classList.add('ativo');
    });
  });
});

// ===============================================
// 4. DASHBOARD (index.html) - Estatísticas
// ===============================================
async function carregarEstatisticasDashboard() {
  if (!document.getElementById('salas-disponiveis')) return;

  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const update = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    update('salas-disponiveis', data.salasDisponiveis);
    update('labs-disponiveis', data.labsDisposiveis);
    update('reservas-ativas', data.reservasAtivas);
    update('devolucoes-pendentes', data.devolucoesPendentes);
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

// ===============================================
// 5. RESERVAS (reservas.html) - FILTROS E SALAS
// ===============================================

/**
 * CARREGA FILTROS (TIPO, LOCALIZAÇÃO E FAIXAS DE CAPACIDADE)
 */
async function carregarFiltros() {
  const selectTipo = document.getElementById('tipo');
  const selectLocal = document.getElementById('localizacao');
  const selectCapacidade = document.getElementById('capacidade');
  if (!selectTipo || !selectLocal || !selectCapacidade) return;

  try {
    const res = await fetch('/api/filtros-salas');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { tipos, localizacoes, faixas } = await res.json();

    selectTipo.innerHTML = '<option value="todos">Todos</option>';
    selectLocal.innerHTML = '<option value="todos">Todos</option>';
    selectCapacidade.innerHTML = '<option value="todos">Todos</option>';

    tipos.forEach(tipo => selectTipo.appendChild(new Option(tipo, tipo)));
    localizacoes.forEach(loc => selectLocal.appendChild(new Option(loc, loc)));

    // Faixas com texto amigável
    faixas.forEach(faixa => {
      let texto = faixa === '40+' ? '40+ alunos' : `${faixa} alunos`;
      selectCapacidade.appendChild(new Option(texto, faixa));
    });

  } catch (err) {
    console.error('Erro ao carregar filtros:', err);
  }
}

/**
 * FILTRA SALAS AO MUDAR QUALQUER SELECT
 */
function filtrarSalas() {
  const tipo = document.getElementById('tipo')?.value || 'todos';
  const localizacao = document.getElementById('localizacao')?.value || 'todos';
  const capacidade = document.getElementById('capacidade')?.value || 'todos';

  const filtros = { tipo, localizacao, capacidade };
  carregarSalas(filtros); // agora aceita filtros!
}

/**
 * CARREGA E EXIBE AS SALAS (COM FILTROS)
 */
async function carregarSalas(filtros = {}) {
  const container = document.getElementById('salas-lista');
  if (!container) return;

  try {
    console.log('Carregando salas com filtros:', filtros);
    const params = new URLSearchParams();
    if (filtros.tipo && filtros.tipo !== 'todos') params.append('tipo', filtros.tipo);
    if (filtros.localizacao && filtros.localizacao !== 'todos') params.append('localizacao', filtros.localizacao);
    if (filtros.capacidade && filtros.capacidade !== 'todos') params.append('capacidade', filtros.capacidade);

    const url = `/api/salas${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // 🔹 Salva globalmente
    salas = await response.json();

    container.innerHTML = '';
    if (salas.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#666;">Nenhuma sala encontrada com os filtros aplicados.</p>';
      return;
    }

    salas.forEach(sala => {
      const disponivel = ['101', '310'].includes(sala.numero_sala);
      const card = document.createElement('div');
      card.className = 'sala-card';
      card.innerHTML = `
        <div class="status-top-right">
          <span class="status-texto ${disponivel ? 'disponivel' : 'indisponivel'}">
            ${disponivel ? 'Disponível' : 'Indisponível'}
          </span>
          <img src="./imgs/${disponivel ? 'check' : 'unavailable'}.png"
               alt="${disponivel ? 'Disponível' : 'Indisponível'}"
               class="status-icone">
        </div>
        <div class="sala-imagem">
          <img src="./imgs/sala-placeholder.jpg" alt="Sala ${sala.numero_sala}">
        </div>
        <div class="sala-info">
          <h3>Sala ${sala.numero_sala}</h3>
          <div class="sala-detalhes">
            <p><strong>Tipo de sala:</strong> ${sala.tipo_sala}</p>
            <p><strong>Localização:</strong> ${sala.localizacao}</p>
            <p><strong>Capacidade:</strong> ${sala.capacidade}</p>
          </div>
          <div class="acoes-card">
            <button class="btn-detalhes" data-sala-id="${sala.id}">Ver Detalhes</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // 🔹 Agora o JS reconhece “salas” no clique:
    document.querySelectorAll('.btn-detalhes').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.salaId;
        const sala = salas.find(s => s.id == id);
        abrirModal(sala);
      };
    });
  } catch (error) {
    console.error('Erro ao carregar salas:', error);
  }
}

/**
 * CHAMADA ÚNICA NO DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  setActivePage();

  // === PÁGINA INICIAL ===
  if (window.location.pathname === '/') {
    carregarEstatisticasDashboard();
  }

  // === PÁGINA DE RESERVAS ===
  if (window.location.pathname === '/reservas') {
    carregarFiltros();
    carregarSalas(); // carrega todas inicialmente
  }
});

// === MODAL DE DETALHES ===
let salaSelecionada = null;
let dataSelecionada = null;

/**
 * ABRE MODAL COM DETALHES DA SALA
 */
function abrirModal(sala) {
  salaSelecionada = sala;

  const el = (id) => document.getElementById(id);

  // === DADOS BÁSICOS ===
  el("modal-numero").textContent = `Sala ${sala.numero_sala}`;
  el("modal-tipo").textContent = sala.tipo_sala;
  el("modal-localizacao").textContent = sala.localizacao;
  el("modal-capacidade").textContent = sala.capacidade;

  // === IMAGEM (DO BANCO, SEM FALLBACK NO JS) ===
  const img = el("modal-imagem");
  img.src = `/api/salas/${sala.id}/imagem`; // ROTA CUIDA DO PLACEHOLDER

  // === DETALHES VISUAIS COM BOLINHAS ===
  const setBolinha = (id, valor) => {
    const bolinha = document.getElementById(id);
    if (bolinha) {
      bolinha.classList.toggle('preenchida', valor);
    }
  };

  setBolinha('modal-projetor', sala.projetor);
  setBolinha('modal-ar', sala.ar_condicionado);
  setBolinha('modal-tv', sala.televisao);
  setBolinha('modal-pc', sala.computador);

  // === RESET RESERVA ===
  dataSelecionada = null;
  el("solicitante").value = "";
  el("periodo").value = "";
  renderizarCalendario();
  atualizarStatusDisponibilidade();

  // === ABRE MODAL ===
  document.getElementById("modal-detalhes").style.display = "flex";
}


/**
 * FECHA MODAL
 */
function fecharModal() {
  document.getElementById("modal-detalhes").style.display = "none";
}

/**
 * RENDERIZA CALENDÁRIO SIMPLES
 */
function renderizarCalendario() {
  const container = document.getElementById('calendario');
  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  let html = `
    <div style="text-align:center; margin-bottom:10px; font-weight:bold;">
      ${hoje.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
    </div>
    <div style="display:grid; grid-template-columns: repeat(7, 1fr); text-align:center; font-weight:bold; margin-bottom:5px;">
      <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
    </div>
    <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:5px;">
  `;

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  for (let i = 0; i < primeiroDia; i++) {
    html += `<div></div>`;
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const data = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const isHoje = dia === hoje.getDate();
    html += `
      <div onclick="selecionarDia('${data}')" 
           style="padding:8px; border:1px solid #ddd; border-radius:6px; cursor:pointer; 
                  ${isHoje ? 'background:#e3f2fd; font-weight:bold;' : ''}"
           onmouseover="this.style.background='#f0f0f0'" 
           onmouseout="this.style.background=${isHoje ? '#e3f2fd' : 'white'}">
        ${dia}
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

/**
 * SELECIONA DIA NO CALENDÁRIO
 */
function selecionarDia(data) {
  dataSelecionada = data;
  alert(`Data selecionada: ${data}\nAgora escolha o período.`);
  atualizarStatusDisponibilidade();
}

/**
 * ATUALIZA STATUS DE DISPONIBILIDADE
 */
async function atualizarStatusDisponibilidade() {
  if (!salaSelecionada || !dataSelecionada) {
    document.getElementById('modal-status-icone').src = './imgs/check.png';
    document.getElementById('modal-status-texto').textContent = 'Disponível';
    document.querySelector('.modal-status').classList.remove('indisponivel');
    return;
  }

  const periodo = document.getElementById('periodo').value;
  if (!periodo) {
    document.getElementById('modal-status-texto').textContent = 'Selecione período';
    document.getElementById('modal-status-icone').src = './imgs/check.png';
    return;
  }

  try {
    const res = await fetch(`/api/reservas/verificar?sala_id=${salaSelecionada.id}&data=${dataSelecionada}&periodo=${periodo}`);
    const { ocupado } = await res.json();

    const icone = document.getElementById('modal-status-icone');
    const texto = document.getElementById('modal-status-texto');
    const statusDiv = document.querySelector('.modal-status');

    if (ocupado) {
      icone.src = './imgs/unavailable.png';
      texto.textContent = 'Indisponível';
      statusDiv.classList.add('indisponivel');
    } else {
      icone.src = './imgs/check.png';
      texto.textContent = 'Disponível';
      statusDiv.classList.remove('indisponivel');
    }
  } catch (err) {
    console.error('Erro ao verificar:', err);
  }
}

/**
 * FAZ RESERVA
 */
async function fazerReserva() {
  const solicitante = document.getElementById('solicitante').value.trim();
  const periodo = document.getElementById('periodo').value;

  if (!salaSelecionada || !dataSelecionada || !solicitante || !periodo) {
    alert('Preencha todos os campos!');
    return;
  }

  try {
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sala_id: salaSelecionada.id,
        data_inicio: `${dataSelecionada} ${periodo === 'manha' ? '08:00' : periodo === 'tarde' ? '14:00' : '19:00'}:00`,
        data_fim: `${dataSelecionada} ${periodo === 'manha' ? '12:00' : periodo === 'tarde' ? '18:00' : '22:00'}:00`,
        solicitante
      })
    });

    if (res.ok) {
      alert('Reserva realizada com sucesso!');
      fecharModal();
      carregarSalas();
    } else {
      alert('Erro ao reservar. Tente novamente.');
    }
  } catch (err) {
    alert('Erro de conexão.');
  }
}

// === MODAL ADICIONAR SALA ===
function abrirModalAdicionar() {
  document.getElementById('modal-adicionar-sala').style.display = 'flex';
  carregarOpcoesFiltros(); // reutiliza a função de reservas
}

function fecharModalAdicionar() {
  const modal = document.getElementById('modal-adicionar-sala');
  if (modal) modal.style.display = 'none';
  limparFormularioAdicionar();

  // Reseta
  const titulo = document.getElementById('modal-titulo-sala');
  const btn = document.getElementById('btn-acao-sala');
  if (titulo) titulo.textContent = 'Detalhes da Sala:';
  if (btn) {
    btn.textContent = 'Adicionar Sala';
    btn.onclick = adicionarSala;
  }
}

// Toggle bolinha
function toggleBolinha(el) {
  el.classList.toggle('preenchida');
}

// Preview imagem
function previewImagem(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('preview-imagem').src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

// Limpar formulário
function limparFormularioAdicionar() {
  document.getElementById('novo-numero').value = '';
  document.getElementById('upload-imagem').value = '';
  document.getElementById('preview-imagem').src = './imgs/plus-photo.png';
  document.getElementById('novo-capacidade').value = '';
  document.getElementById('novo-localizacao').value = '';
  document.getElementById('novo-tipo').value = '';

  // Desmarcar bolinhas
  document.querySelectorAll('.bolinha-checkbox').forEach(b => b.classList.remove('preenchida'));
}

// Reutiliza carregarFiltros() com segurança
async function carregarOpcoesFiltros() {
  const selectLocal = document.getElementById('novo-localizacao');
  const selectTipo = document.getElementById('novo-tipo');
  
  if (!selectLocal || !selectTipo) {
    console.warn('Selects de edição não encontrados');
    return;
  }

  try {
    const res = await fetch('/api/filtros-salas');
    if (!res.ok) throw new Error('Erro ao carregar filtros');
    const { localizacoes, tipos } = await res.json();

    // Limpa e preenche
    selectLocal.innerHTML = '<option value="">Escolha uma opção</option>';
    selectTipo.innerHTML = '<option value="">Escolha uma opção</option>';

    localizacoes.forEach(loc => selectLocal.appendChild(new Option(loc, loc)));
    tipos.forEach(tipo => selectTipo.appendChild(new Option(tipo, tipo)));
  } catch (err) {
    console.error('Erro ao carregar opções de filtro:', err);
  }
}

function abrirModalEditar() {
  if (!salaSelecionada) return;

  salaEditando = salaSelecionada;

  const el = (id) => document.getElementById(id);
  if (!el('novo-numero')) return; // segurança

  // Preenche campos
  el('novo-numero').value = salaEditando.numero_sala;
  el('novo-capacidade').value = salaEditando.capacidade;
  el('novo-localizacao').value = salaEditando.localizacao;
  el('novo-tipo').value = salaEditando.tipo_sala;

  // Bolinhas
  ['projetor', 'ar_condicionado', 'televisao', 'computador'].forEach((campo, i) => {
    const id = ['check-projetor', 'check-ar', 'check-tv', 'check-pc'][i];
    const valor = salaEditando[campo];
    const b = el(id);
    if (b) b.classList.toggle('preenchida', valor);
  });

  // Imagem
  const preview = el('preview-imagem');
  if (preview) preview.src = `/api/salas/${salaEditando.id}/imagem`;

  // Título e botão
  el('modal-titulo-sala').textContent = `Editar Sala ${salaEditando.numero_sala}`;
  const btn = el('btn-acao-sala');
  btn.textContent = 'Salvar Alterações';
  btn.onclick = salvarEdicao;

  // ABRE MODAL
  const modal = document.getElementById('modal-adicionar-sala');
  modal.style.display = 'flex';
  carregarOpcoesFiltros();
}

async function salvarEdicao() {
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
    alert('Preencha todos os campos!');
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
    const res = await fetch(`/api/salas/${salaEditando.id}`, {
      method: 'PUT',
      body: formData
    });

    if (res.ok) {
      alert('Sala atualizada com sucesso!');
      fecharModalAdicionar();
      fecharModal(); // fecha o de detalhes
      carregarSalas(); // atualiza lista
      carregarEstatisticasDashboard();
    } else {
      const erro = await res.text();
      alert('Erro ao salvar: ' + erro);
    }
  } catch (err) {
    alert('Erro de conexão.');
  }
}