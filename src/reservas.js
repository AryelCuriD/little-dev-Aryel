
import { setActivePage, toggleBolinha, previewImagem, notificarFimReserva } from './global.js';

// Expõe funções globais para o HTML
window.previewImagem = previewImagem;
window.toggleBolinha = toggleBolinha;

let salas = [];
let salaSelecionada = null;
let dataSelecionada = null;
let intervaloAtualizacao = null;

document.addEventListener('DOMContentLoaded', () => {
  setActivePage();
  carregarFiltros();
  carregarSalas();
  iniciarAtualizacaoAutomatica();
});

// === FILTROS ===
async function carregarFiltros() {
  const selectTipo = document.getElementById('tipo');
  const selectLocal = document.getElementById('localizacao');
  const selectCapacidade = document.getElementById('capacidade');
  if (!selectTipo || !selectLocal || !selectCapacidade) return;

  try {
    const res = await fetch('/api/filtros-salas');
    if (!res.ok) throw new Error('Falha ao buscar filtros');
    const { tipos, localizacoes, faixas } = await res.json();

    const addOptions = (select, items, placeholder) => {
      select.innerHTML = `<option value="todos">${placeholder}</option>`;
      items.forEach(item => select.appendChild(new Option(item, item)));
    };

    addOptions(selectTipo, tipos, 'Todos');
    addOptions(selectLocal, localizacoes, 'Todos');
    selectCapacidade.innerHTML = '<option value="todos">Todos</option>';
    faixas.forEach(f => {
      const texto = f === '40+' ? '40+ alunos' : `${f} alunos`;
      selectCapacidade.appendChild(new Option(texto, f));
    });

    [selectTipo, selectLocal, selectCapacidade].forEach(s => s.onchange = filtrarSalas);
  } catch (err) {
    console.error('Erro ao carregar filtros:', err);
  }
}

function filtrarSalas() {
  const filtros = {
    tipo: document.getElementById('tipo')?.value || 'todos',
    localizacao: document.getElementById('localizacao')?.value || 'todos',
    capacidade: document.getElementById('capacidade')?.value || 'todos'
  };
  carregarSalas(filtros);
}

// === CARREGAR SALAS ===
async function carregarSalas(filtros = {}) {
  const container = document.getElementById('salas-lista');
  if (!container) return;

  try {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v && v !== 'todos') params.append(k, v);
    });

    const url = `/api/salas${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao buscar salas');
    salas = await res.json();

    let statusMap = {};
    try {
      const statusRes = await fetch('/api/dashboard/salas-status');
      if (statusRes.ok) {
        const statusList = await statusRes.json();
        statusList.forEach(s => statusMap[s.id] = s.disponivel);
      }
    } catch (err) {
      console.error('Erro ao carregar status:', err);
    }

    container.innerHTML = salas.length === 0
      ? '<p style="text-align:center; color:#666;">Nenhuma sala encontrada.</p>'
      : salas.map(sala => {
          const disponivel = statusMap[sala.id] !== false;
          return `
            <div class="sala-card">
              <div class="status-top-right">
                <span class="status-texto ${disponivel ? 'disponivel' : 'indisponivel'}">
                  ${disponivel ? 'Disponível' : 'Indisponível'}
                </span>
                <img src="./imgs/${disponivel ? 'check' : 'unavailable'}.png" class="status-icone">
              </div>
              <div class="sala-imagem">
                <img src="/api/salas/${sala.id}/imagem" alt="Sala ${sala.numero_sala}"
                     onerror="this.src='./imgs/sala-placeholder.jpg'; this.onerror=null;">
              </div>
              <div class="sala-info">
                <h3>Sala ${sala.numero_sala}</h3>
                <div class="sala-detalhes">
                  <p><strong>Tipo:</strong> ${sala.tipo_sala}</p>
                  <p><strong>Local:</strong> ${sala.localizacao}</p>
                  <p><strong>Capacidade:</strong> ${sala.capacidade}</p>
                </div>
                <div class="acoes-card">
                  <button class="btn-detalhes" data-sala-id="${sala.id}">Ver Detalhes</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

    document.querySelectorAll('.btn-detalhes').forEach(btn => {
      btn.onclick = () => {
        const sala = salas.find(s => s.id == btn.dataset.salaId);
        if (!sala) return console.error('Sala não encontrada');
        abrirModal(sala);
      };
    });
  } catch (err) {
    console.error('Erro ao carregar salas:', err);
    container.innerHTML = '<p style="color:red;">Erro ao carregar salas.</p>';
  }
}

// === MODAL DETALHES ===
function abrirModal(sala) {
  salaSelecionada = sala;
  dataSelecionada = null;

  const el = id => document.getElementById(id);
  if (!el('modal-numero')) return;

  el("modal-numero").textContent = `Sala ${sala.numero_sala}`;
  el("modal-tipo").textContent = sala.tipo_sala;
  el("modal-localizacao").textContent = sala.localizacao;
  el("modal-capacidade").textContent = sala.capacidade;
  const imgEl = el("modal-imagem");
  if (imgEl) imgEl.src = `/api/salas/${sala.id}/imagem`;

  const setBolinha = (id, valor) => {
    const b = el(id);
    if (b) b.classList.toggle('preenchida', !!valor);
  };
  setBolinha('modal-projetor', sala.projetor);
  setBolinha('modal-ar', sala.ar_condicionado);
  setBolinha('modal-tv', sala.televisao);
  setBolinha('modal-pc', sala.computador);

  if (el("solicitante")) el("solicitante").value = "";

  const hoje = new Date();
  calendarioMes = hoje.getMonth();
  calendarioAno = hoje.getFullYear();
  renderizarCalendario();
  inicializarHorarios();
  atualizarStatusDisponibilidade();

  const btnEditar = document.querySelector('.btn-editar-sala');
  if (btnEditar) btnEditar.dataset.salaId = sala.id;

  const modal = document.getElementById("modal-detalhes");
  if (modal) modal.style.display = "flex";
}

function fecharModal() {
  const modal = document.getElementById("modal-detalhes");
  if (modal) modal.style.display = "none";
}

// === CARREGAR OPÇÕES PARA SELECTS ===
async function carregarOpcoesSala() {
  const selectTipo = document.getElementById('novo-tipo');
  const selectLocal = document.getElementById('novo-localizacao');
  const selectCapacidade = document.getElementById('novo-capacidade');

  if (!selectTipo || !selectLocal || !selectCapacidade) return;

  try {
    const url = '/api/salas/opcoes';
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const limpar = select => {
      select.innerHTML = '<option value="">Escolha uma opção</option>';
    };

    limpar(selectTipo);
    limpar(selectLocal);
    limpar(selectCapacidade);

    (data.tipos || []).forEach(t => selectTipo.add(new Option(t, t)));
    (data.localizacoes || []).forEach(l => selectLocal.add(new Option(l, l)));
    (data.capacidades || []).forEach(c => {
      const texto = c === '40+' ? '40+ alunos' : `${c} alunos`;
      selectCapacidade.add(new Option(texto, c));
    });

  } catch (err) {
    console.error('[FALHA] Erro ao carregar opções:', err);
    alert('Erro ao carregar opções da sala.');
  }
}

// === EDITAR SALA ===
async function abrirModalEditar() {
  const btnEditar = document.querySelector('.btn-editar-sala');
  const salaId = btnEditar?.dataset.salaId;

  if (!salaId) {
    alert('Erro: sala não identificada.');
    return;
  }

  try {
    const res = await fetch(`/api/salas/${salaId}`);
    if (!res.ok) throw new Error('Sala não encontrada');
    const sala = await res.json();

    await carregarOpcoesSala();

    const el = id => document.getElementById(id);
    el('modal-titulo-sala').textContent = 'Editar Sala';
    el('novo-numero').value = sala.numero_sala || '';
    el('novo-tipo').value = sala.tipo_sala || '';
    el('novo-localizacao').value = sala.localizacao || '';
    el('novo-capacidade').value = sala.capacidade || '';

    const setBolinha = (id, valor) => {
      const b = el(id);
      if (b) b.classList.toggle('preenchida', !!valor);
    };
    setBolinha('check-projetor', sala.projetor);
    setBolinha('check-ar', sala.ar_condicionado);
    setBolinha('check-tv', sala.televisao);
    setBolinha('check-pc', sala.computador);

    const preview = el('preview-imagem');
    if (preview) preview.src = `/api/salas/${salaId}/imagem?t=${Date.now()}`;

    const btnAcao = el('btn-acao-sala');
    if (btnAcao) {
      btnAcao.textContent = 'Salvar Alterações';
      btnAcao.onclick = () => salvarEdicao(salaId);
    }

    fecharModal();
    const modalEdit = document.getElementById('modal-adicionar-sala');
    if (modalEdit) modalEdit.style.display = 'flex';

  } catch (err) {
    console.error('Erro ao abrir edição:', err);
    alert('Erro ao carregar dados da sala.');
  }
}

// === SALVAR EDIÇÃO ===
async function salvarEdicao(salaId) {
  const el = id => document.getElementById(id);
  const numero = el('novo-numero')?.value.trim();
  const tipo = el('novo-tipo')?.value;
  const local = el('novo-localizacao')?.value;
  const capacidade = el('novo-capacidade')?.value;

  if (!numero || !tipo || !local || !capacidade) {
    alert('Preencha todos os campos!');
    return;
  }

  const formData = new FormData();
  formData.append('numero_sala', numero);
  formData.append('tipo_sala', tipo);
  formData.append('localizacao', local);
  formData.append('capacidade', capacidade);
  formData.append('projetor', el('check-projetor').classList.contains('preenchida'));
  formData.append('ar_condicionado', el('check-ar').classList.contains('preenchida'));
  formData.append('televisao', el('check-tv').classList.contains('preenchida'));
  formData.append('computador', el('check-pc').classList.contains('preenchida'));

  const fileInput = el('upload-imagem');
  if (fileInput?.files[0]) formData.append('imagem', fileInput.files[0]);

  try {
    const res = await fetch(`/api/salas/${salaId}`, {
      method: 'PUT',
      body: formData
    });

    if (res.ok) {
      alert('Sala atualizada com sucesso!');
      fecharModalAdicionar();
      carregarSalas();
    } else {
      const erro = await res.text();
      alert('Erro ao salvar: ' + erro);
    }
  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert('Erro de conexão.');
  }
}

function fecharModalAdicionar() {
  const modal = document.getElementById('modal-adicionar-sala');
  if (modal) modal.style.display = 'none';

  const upload = document.getElementById('upload-imagem');
  if (upload) upload.value = '';

  const preview = document.getElementById('preview-imagem');
  if (preview) preview.src = './imgs/plus-photo.png';

  ['novo-tipo', 'novo-localizacao', 'novo-capacidade'].forEach(id => {
    const select = document.getElementById(id);
    if (select) select.innerHTML = '<option value="">Escolha uma opção</option>';
  });

  const btn = document.getElementById('btn-acao-sala');
  if (btn) {
    btn.textContent = 'Adicionar Sala';
    btn.onclick = null;
  }
}

// === EXPOSIÇÃO GLOBAL ===
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.fazerReserva = fazerReserva;
window.mudarMes = mudarMes;
window.selecionarDia = selecionarDia;
window.atualizarHoraFim = atualizarHoraFim;
window.abrirModalEditar = abrirModalEditar;
window.salvarEdicao = salvarEdicao;
window.fecharModalAdicionar = fecharModalAdicionar;

// === CALENDÁRIO, HORÁRIOS E RESERVA ===
let calendarioMes = new Date().getMonth();
let calendarioAno = new Date().getFullYear();

function selecionarDia(data) {
  dataSelecionada = data;
  renderizarCalendario();
  atualizarStatusDisponibilidade();
}

function renderizarCalendario() {
  const container = document.getElementById('calendario');
  if (!container) return;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const mesAtual = new Date(calendarioAno, calendarioMes);
  const nomeMes = mesAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const primeiroDia = new Date(calendarioAno, calendarioMes, 1).getDay();
  const diasNoMes = new Date(calendarioAno, calendarioMes + 1, 0).getDate();

  let html = `
    <div class="calendario-header">
      <button onclick="mudarMes(-1)" class="calendario-seta" id="seta-esquerda">Previous</button>
      <div class="calendario-titulo">${nomeMes}</div>
      <button onclick="mudarMes(1)" class="calendario-seta">Next</button>
    </div>
    <div class="calendario-dias-semana">
      <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
    </div>
    <div class="calendario-grid">
  `;

  for (let i = 0; i < primeiroDia; i++) html += `<div class="calendario-dia vazio"></div>`;

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataObj = new Date(calendarioAno, calendarioMes, dia);
    dataObj.setHours(0, 0, 0, 0);
    const dataStr = `${calendarioAno}-${String(calendarioMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const isHoje = dataObj.getTime() === hoje.getTime();
    const isPassado = dataObj < hoje;
    const isSelecionado = dataStr === dataSelecionada;

    const classe = isPassado ? 'calendario-dia desabilitado' : `calendario-dia ${isHoje ? 'hoje' : ''} ${isSelecionado ? 'selecionado' : ''}`;
    const onclick = isPassado ? '' : `onclick="selecionarDia('${dataStr}')"`;

    html += `<div ${onclick} class="${classe}">${dia}</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  const setaEsquerda = document.getElementById('seta-esquerda');
  if (setaEsquerda) {
    const bloqueado = (calendarioMes === hoje.getMonth() && calendarioAno === hoje.getFullYear());
    setaEsquerda.disabled = bloqueado;
    setaEsquerda.style.opacity = bloqueado ? '0.3' : '1';
  }
}

function mudarMes(delta) {
  const hoje = new Date();
  const novoMes = calendarioMes + delta;
  const novoAno = calendarioAno + Math.floor(novoMes / 12);
  const mesAjustado = ((novoMes % 12) + 12) % 12;

  if (novoAno < hoje.getFullYear() || (novoAno === hoje.getFullYear() && mesAjustado < hoje.getMonth())) return;

  calendarioMes = mesAjustado;
  calendarioAno = novoAno;
  renderizarCalendario();
  atualizarStatusDisponibilidade();
}

function gerarHorarios() {
  const horarios = [];
  for (let h = 7; h <= 18; h++) {
    if (h !== 12) horarios.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 18 && h !== 12) horarios.push(`${String(h).padStart(2, '0')}:30`);
  }
  return horarios;
}

function inicializarHorarios() {
  const inicioSelect = document.getElementById('hora-inicio');
  const fimSelect = document.getElementById('hora-fim');
  if (!inicioSelect || !fimSelect) return;

  const horarios = gerarHorarios();
  [inicioSelect, fimSelect].forEach(select => {
    select.innerHTML = '<option value="">Selecione</option>';
    horarios.forEach(h => select.appendChild(new Option(h, h)));
  });
  fimSelect.disabled = true;
}

function atualizarHoraFim() {
  const inicio = document.getElementById('hora-inicio')?.value;
  const fimSelect = document.getElementById('hora-fim');
  if (!fimSelect || !inicio) {
    fimSelect.innerHTML = '<option value="">Selecione</option>';
    fimSelect.disabled = true;
    return;
  }

  const horarios = gerarHorarios();
  const idxInicio = horarios.indexOf(inicio);
  if (idxInicio === -1) return;

  fimSelect.innerHTML = '<option value="">Selecione</option>';
  for (let i = idxInicio + 1; i < horarios.length; i++) {
    fimSelect.appendChild(new Option(horarios[i], horarios[i]));
  }
  fimSelect.disabled = false;
}

async function atualizarStatusDisponibilidade() {
  const inicio = document.getElementById('hora-inicio')?.value;
  const fim = document.getElementById('hora-fim')?.value;
  const statusTexto = document.getElementById('modal-status-texto');
  const statusIcone = document.getElementById('modal-status-icone');
  const statusDiv = document.querySelector('.modal-status');

  if (!statusTexto || !statusIcone || !statusDiv) return;

  if (!dataSelecionada || !inicio || !fim) {
    statusTexto.textContent = 'Selecione data e horário';
    statusIcone.src = './imgs/check.png';
    statusDiv.classList.remove('indisponivel');
    return;
  }

  const dataInicio = `${dataSelecionada} ${inicio}:00`;
  const dataFim = `${dataSelecionada} ${fim}:00`;

  try {
    const res = await fetch(`/api/reservas/verificar-range?sala_id=${salaSelecionada.id}&inicio=${encodeURIComponent(dataInicio)}&fim=${encodeURIComponent(dataFim)}`);
    if (!res.ok) throw new Error();
    const { ocupado } = await res.json();
    statusTexto.textContent = ocupado ? 'Indisponível' : 'Disponível';
    statusIcone.src = `./imgs/${ocupado ? 'unavailable' : 'check'}.png`;
    statusDiv.classList.toggle('indisponivel', ocupado);
  } catch (err) {
    statusTexto.textContent = 'Erro';
  }
}

async function fazerReserva() {
  const solicitante = document.getElementById('solicitante')?.value.trim();
  const inicio = document.getElementById('hora-inicio')?.value;
  const fim = document.getElementById('hora-fim')?.value;

  if (!salaSelecionada || !dataSelecionada || !solicitante || !inicio || !fim) {
    alert('Preencha todos os campos!');
    return;
  }

  if (inicio >= fim) {
    alert('Hora de término deve ser após o início!');
    return;
  }

  const dataInicio = `${dataSelecionada} ${inicio}:00`;
  const dataFim = `${dataSelecionada} ${fim}:00`;

  try {
    const verificar = await fetch(`/api/reservas/verificar-range?sala_id=${salaSelecionada.id}&inicio=${encodeURIComponent(dataInicio)}&fim=${encodeURIComponent(dataFim)}`);
    if (!verificar.ok) throw new Error();
    const { ocupado } = await verificar.json();
    if (ocupado) {
      alert('Este horário já está reservado!');
      return;
    }
  } catch (err) {
    alert('Erro ao verificar disponibilidade.');
    return;
  }

  if (!confirm(`Reservar Sala ${salaSelecionada.numero_sala}\nData: ${dataSelecionada}\nHorário: ${inicio} às ${fim}\nSolicitante: ${solicitante}`)) {
    return;
  }

  try {
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sala_id: salaSelecionada.id,
        data_inicio: dataInicio,
        data_fim: dataFim,
        solicitante
      })
    });

    if (res.ok) {
      localStorage.setItem('atualizar_dashboard', Date.now().toString());

      // === DISPARA NOTIFICAÇÃO GLOBAL ===
      const notificacao = {
        sala: `Sala ${salaSelecionada.numero_sala}`,
        solicitante: solicitante
      };
      localStorage.setItem('notificacao_fim_reserva', JSON.stringify(notificacao));

      alert('Reserva realizada com sucesso!');
      fecharModal();
      carregarSalas();
    } else {
      const erro = await res.text();
      alert('Erro ao reservar: ' + erro);
    }
  } catch (err) {
    console.error('Erro de conexão:', err);
    alert('Erro de conexão.');
  }
}

function iniciarAtualizacaoAutomatica() {
  if (intervaloAtualizacao) clearInterval(intervaloAtualizacao);
  intervaloAtualizacao = setInterval(carregarSalas, 30000);
}

export {};