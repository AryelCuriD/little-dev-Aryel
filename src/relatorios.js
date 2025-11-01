// src/relatorios.js
import { setActivePage } from './global.js';

let reservasConcluidas = [];
let devolucoes = [];

document.addEventListener('DOMContentLoaded', () => {
  setActivePage();
  carregarDevolucoes();
  carregarReservasPendentesDevolucao();

  document.getElementById('btn-criar-devolucao').onclick = abrirModalDevolucao;
  document.getElementById('btn-salvar-devolucao').onclick = salvarDevolucao;
  document.getElementById('btn-baixar-relatorio').onclick = gerarPDF;
});

// === CARREGAR DEVOLUÇÕES ===
async function carregarDevolucoes() {
  try {
    const res = await fetch('/api/devolucoes');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    devolucoes = await res.json();
    renderizarTabela();
  } catch (err) {
    console.error('Erro ao carregar devoluções:', err);
    // MOCK TEMPORÁRIO
    devolucoes = [];
    renderizarTabela();
  }
}

// === CARREGAR RESERVAS PENDENTES ===
async function carregarReservasPendentesDevolucao() {
  try {
    const res = await fetch('/api/reservas/pendentes-devolucao');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    reservasConcluidas = Array.isArray(data) ? data : [];
    popularSelectReservas();
  } catch (err) {
    console.error('Erro ao carregar reservas pendentes:', err);
    // MOCK TEMPORÁRIO
    reservasConcluidas = [
      {
        id: 1,
        numero_sala: "101",
        solicitante: "João Silva",
        data_inicio: "2025-11-01 14:00:00",
        horario: "14:00 - 16:00"
      }
    ];
    popularSelectReservas();
  }
}

// === POPULAR SELECT ===
function popularSelectReservas() {
  const select = document.getElementById('select-reserva');
  select.innerHTML = '<option value="">Selecione uma reserva</option>';

  if (!Array.isArray(reservasConcluidas) || reservasConcluidas.length === 0) {
    select.innerHTML += '<option disabled>Nenhuma reserva pendente</option>';
    return;
  }

  reservasConcluidas.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.dataset.sala = r.numero_sala;
    opt.dataset.solicitante = r.solicitante;
    opt.dataset.data = r.data_inicio.split(' ')[0];
    opt.dataset.horario = r.horario;
    opt.textContent = `Sala ${r.numero_sala} - ${r.solicitante} - ${new Date(r.data_inicio).toLocaleDateString('pt-BR')} ${r.horario}`;
    select.appendChild(opt);
  });
}

// === RENDERIZAR TABELA ===
function renderizarTabela() {
  const tbody = document.querySelector('#tabela-devolucoes tbody');
  const semDados = document.getElementById('sem-dados');

  if (!Array.isArray(devolucoes) || devolucoes.length === 0) {
    semDados.style.display = 'block';
    tbody.innerHTML = '';
    return;
  }

  semDados.style.display = 'none';
  tbody.innerHTML = devolucoes.map(d => `
    <tr>
      <td>${d.id}</td>
      <td>Sala ${d.numero_sala}</td>
      <td>${d.solicitante}</td>
      <td>${new Date(d.data_devolucao).toLocaleDateString('pt-BR')}</td>
      <td>${d.horario}</td>
      <td><span class="status-${d.estojo}">${d.estojo === 'completo' ? 'Completo' : 'Incompleto'}</span></td>
      <td title="${d.observacao || ''}">${(d.observacao || '-').substring(0, 30)}${d.observacao?.length > 30 ? '...' : ''}</td>
    </tr>
  `).join('');
}

// === MODAL ===
function abrirModalDevolucao() {
  carregarReservasPendentesDevolucao();
  document.getElementById('modal-criar-devolucao').style.display = 'flex';
}

function fecharModalDevolucao() {
  document.getElementById('modal-criar-devolucao').style.display = 'none';
  document.getElementById('select-reserva').value = '';
  document.querySelector('input[name="estojo"][value="completo"]').checked = true;
  document.getElementById('observacao').value = '';
}

// === SALVAR DEVOLUÇÃO ===
async function salvarDevolucao() {
  const reservaId = document.getElementById('select-reserva').value;
  const select = document.getElementById('select-reserva');
  const estojo = document.querySelector('input[name="estojo"]:checked').value;
  const observacao = document.getElementById('observacao').value.trim();

  if (!reservaId) {
    alert('Selecione uma reserva!');
    return;
  }

  try {
    const res = await fetch('/api/devolucoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reserva_id: reservaId,
        estojo: estojo, // 'completo' ou 'incompleto'
        observacao
      })
    });

    if (res.ok) {
      alert('Devolução registrada com sucesso!');
      fecharModalDevolucao();
      carregarDevolucoes();
      carregarReservasPendentesDevolucao();
    } else {
      const erro = await res.json();
      alert('Erro: ' + (erro.error || 'Tente novamente'));
    }
  } catch (err) {
    console.error('Erro de conexão:', err);
    alert('Erro de conexão.');
  }
}

// === GERAR PDF ===
function gerarPDF() {
  const inicio = document.getElementById('data-inicio').value;
  const fim = document.getElementById('data-fim').value;
  const erro = document.getElementById('erro-filtro');

  if (!inicio || !fim || inicio > fim) {
    erro.style.display = 'block';
    return;
  }
  erro.style.display = 'none';
  window.open(`/api/relatorios/devolucao?inicio=${inicio}&fim=${fim}`, '_blank');
}

// Expor funções
window.fecharModalDevolucao = fecharModalDevolucao;