// src/reservas.js
import { setActivePage, toggleBolinha, previewImagem } from './global.js';

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
    if (!res.ok) throw new Error();
    const { tipos, localizacoes, faixas } = await res.json();

    const addOptions = (select, items, placeholder) => {
      select.innerHTML = `<option value="todos">${placeholder}</option>`;
      items.forEach(item => select.appendChild(new Option(item, item)));
    };

    addOptions(selectTipo, tipos, 'Todos');
    addOptions(selectLocal, localizacoes, 'Todos');
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
    if (!res.ok) throw new Error();
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
                <img src="/api/salas/${sala.id}/imagem" alt="Sala ${sala.numero_sala}">
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
        abrirModal(sala);
      };
    });
  } catch (err) {
    console.error('Erro ao carregar salas:', err);
    container.innerHTML = '<p style="color:red;">Erro ao carregar salas.</p>';
  }
}

// === CALENDÁRIO ===
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
      <button onclick="mudarMes(-1)" class="calendario-seta" id="seta-esquerda">←</button>
      <div class="calendario-titulo">${nomeMes}</div>
      <button onclick="mudarMes(1)" class="calendario-seta">→</button>
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

// === HORÁRIOS ===
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
  const inicio = document.getElementById('hora-inicio').value;
  const fimSelect = document.getElementById('hora-fim');
  if (!inicio) {
    fimSelect.innerHTML = '<option value="">Selecione</option>';
    fimSelect.disabled = true;
    return;
  }

  const horarios = gerarHorarios();
  const idxInicio = horarios.indexOf(inicio);
  if (idxInicio === -1) return;

  fimSelect.innerHTML = '<option value="">Selecione</option>';
  for (let i = idxInicio + 1; i < horarios.length; i++) {
    const opt = new Option(horarios[i], horarios[i]);
    fimSelect.appendChild(opt);
  }
  fimSelect.disabled = false;
}

// === MODAL DETALHES ===
async function atualizarStatusDisponibilidade() {
  const inicio = document.getElementById('hora-inicio')?.value;
  const fim = document.getElementById('hora-fim')?.value;
  const statusTexto = document.getElementById('modal-status-texto');
  const statusIcone = document.getElementById('modal-status-icone');
  const statusDiv = document.querySelector('.modal-status');

  if (!dataSelecionada || !inicio || !fim) {
    statusTexto.textContent = 'Selecione data e horário';
    statusIcone.src = './imgs/check.png';
    statusDiv.classList.remove('indisponivel');
    return;
  }

  const dataInicio = `${dataSelecionada} ${inicio}:00`;
  const dataFim = `${dataSelecionada} ${fim}:00`;

  try {
    const res = await fetch(`/api/reservas/verificar-range?sala_id=${salaSelecionada.id}&inicio=${dataInicio}&fim=${dataFim}`);
    const { ocupado } = await res.json();
    statusTexto.textContent = ocupado ? 'Indisponível' : 'Disponível';
    statusIcone.src = `./imgs/${ocupado ? 'unavailable' : 'check'}.png`;
    statusDiv.classList.toggle('indisponivel', ocupado);
  } catch (err) {
    statusTexto.textContent = 'Erro';
  }
}

function abrirModal(sala) {
  salaSelecionada = sala;
  dataSelecionada = null;

  const el = (id) => document.getElementById(id);
  el("modal-numero").textContent = `Sala ${sala.numero_sala}`;
  el("modal-tipo").textContent = sala.tipo_sala;
  el("modal-localizacao").textContent = sala.localizacao;
  el("modal-capacidade").textContent = sala.capacidade;
  el("modal-imagem").src = `/api/salas/${sala.id}/imagem`;

  const setBolinha = (id, valor) => {
    const b = el(id);
    if (b) b.classList.toggle('preenchida', valor);
  };
  setBolinha('modal-projetor', sala.projetor);
  setBolinha('modal-ar', sala.ar_condicionado);
  setBolinha('modal-tv', sala.televisao);
  setBolinha('modal-pc', sala.computador);

  el("solicitante").value = "";

  const hoje = new Date();
  calendarioMes = hoje.getMonth();
  calendarioAno = hoje.getFullYear();
  renderizarCalendario();
  inicializarHorarios();
  atualizarStatusDisponibilidade();

  document.getElementById("modal-detalhes").style.display = "flex";
}

function fecharModal() {
  document.getElementById("modal-detalhes").style.display = "none";
}

// === RESERVA (CORRIGIDA: AVISA A PÁGINA INICIAL) ===
async function fazerReserva() {
  const solicitante = document.getElementById('solicitante').value.trim();
  const inicio = document.getElementById('hora-inicio').value;
  const fim = document.getElementById('hora-fim').value;

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
    const verificar = await fetch(`/api/reservas/verificar-range?sala_id=${salaSelecionada.id}&inicio=${dataInicio}&fim=${dataFim}`);
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
      const data = await res.json();

      // AVISA A PÁGINA INICIAL (EM TEMPO REAL)
      localStorage.setItem('atualizar_dashboard', Date.now().toString());

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

// === ATUALIZAÇÃO AUTOMÁTICA ===
function iniciarAtualizacaoAutomatica() {
  if (intervaloAtualizacao) clearInterval(intervaloAtualizacao);
  intervaloAtualizacao = setInterval(() => {
    carregarSalas();
  }, 30000);
}

// === EXPORTA FUNÇÕES GLOBAIS ===
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.fazerReserva = fazerReserva;
window.mudarMes = mudarMes;
window.selecionarDia = selecionarDia;
window.atualizarHoraFim = atualizarHoraFim;