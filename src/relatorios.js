// src/relatorios.js
import { setActivePage } from './global.js';

let reservasConcluidas = [];
let devolucoes = [];
let filtros = {
  dataInicio: '',
  dataFim: '',
  sala: ''
};

// === DOMContentLoaded: SÓ PARA RELATÓRIOS ===
document.addEventListener('DOMContentLoaded', async () => {
  setActivePage();

  // === ABRIR MODAL AUTOMATICAMENTE (vindo do index.html) ===
  if (localStorage.getItem('abrirModalDevolucao') === 'true') {
    localStorage.removeItem('abrirModalDevolucao');
    setTimeout(abrirModalDevolucao, 300);
  }

  await carregarSalasNoFiltro();
  carregarDevolucoes();
  carregarReservasPendentesDevolucao();

  // === EVENTOS DOS BOTÕES ===
  document.getElementById('btn-criar-devolucao').onclick = abrirModalDevolucao;
  document.getElementById('btn-salvar-devolucao').onclick = salvarDevolucao;
  document.getElementById('btn-baixar-relatorio').onclick = gerarPDF;
  document.getElementById('btn-aplicar-filtro').onclick = aplicarFiltro;
  document.getElementById('btn-limpar-filtro').onclick = limparFiltro;
});

// === CARREGAR SALAS NO FILTRO ===
async function carregarSalasNoFiltro() {
  try {
    console.log('Carregando salas...');
    const res = await fetch('/api/salas');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const salas = await res.json();
    const select = document.getElementById('filtro-sala');
    select.innerHTML = '<option value="">Todas as salas</option>';
    salas.forEach(s => {
      const opt = new Option(`Sala ${s.numero_sala} - ${s.tipo_sala}`, s.id);
      select.appendChild(opt);
    });
    console.log('Salas carregadas:', salas.length);
  } catch (err) {
    console.error('Erro ao carregar salas:', err);
    const select = document.getElementById('filtro-sala');
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// === APLICAR FILTRO ===
function aplicarFiltro() {
  const inicio = document.getElementById('filtro-data-inicio').value;
  const fim = document.getElementById('filtro-data-fim').value;
  const sala = document.getElementById('filtro-sala').value;

  if (inicio && fim && inicio > fim) {
    alert('Data inicial não pode ser maior que a final!');
    return;
  }

  filtros = { dataInicio: inicio, dataFim: fim, sala };
  console.log('FILTRO APLICADO:', filtros);
  carregarDevolucoes();
}

// === LIMPAR FILTRO ===
function limparFiltro() {
  document.getElementById('filtro-data-inicio').value = '';
  document.getElementById('filtro-data-fim').value = '';
  document.getElementById('filtro-sala').value = '';
  filtros = { dataInicio: '', dataFim: '', sala: '' };
  console.log('Filtro limpo');
  carregarDevolucoes();
}

// === CARREGAR DEVOLUÇÕES ===
async function carregarDevolucoes() {
  try {
    let url = '/api/devolucoes';
    const params = new URLSearchParams();
    if (filtros.dataInicio) params.append('inicio', filtros.dataInicio);
    if (filtros.dataFim) params.append('fim', filtros.dataFim);
    if (filtros.sala) params.append('sala_id', filtros.sala);
    if (params.toString()) url += `?${params.toString()}`;

    console.log('Buscando devoluções:', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    devolucoes = await res.json();
    renderizarTabela();
  } catch (err) {
    console.error('Erro ao carregar devoluções:', err);
    devolucoes = [];
    renderizarTabela();
  }
}

// === MODAL ===
function abrirModalDevolucao() {
  const modal = document.getElementById('modal-criar-devolucao');
  modal.classList.add('aberto');
  carregarReservasPendentesDevolucao();
}

function fecharModalDevolucao() {
  const modal = document.getElementById('modal-criar-devolucao');
  modal.classList.remove('aberto');
  document.getElementById('select-reserva').value = '';
  document.querySelector('input[name="estojo"][value="completo"]').checked = true;
  document.getElementById('observacao').value = '';
}

// === SALVAR DEVOLUÇÃO ===
async function salvarDevolucao() {
  const reservaId = document.getElementById('select-reserva').value;
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
      body: JSON.stringify({ reserva_id: reservaId, estojo, observacao })
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
  const inicio = document.getElementById('filtro-data-inicio').value;
  const fim = document.getElementById('filtro-data-fim').value;
  const sala = document.getElementById('filtro-sala').value;

  if (!inicio || !fim || inicio > fim) {
    document.getElementById('erro-filtro').style.display = 'block';
    return;
  }
  document.getElementById('erro-filtro').style.display = 'none';

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('Erro: Biblioteca PDF não carregou.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Devoluções de Chave', 20, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${inicio} a ${fim}`, 20, y);
  y += 8;

  if (sala) {
    const salaNome = document.getElementById('filtro-sala').selectedOptions[0].text;
    doc.text(`Sala: ${salaNome}`, 20, y);
    y += 8;
  }

  doc.text(`Total: ${devolucoes.length} registro(s)`, 20, y);
  y += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(17, 29, 74);
  doc.rect(20, y, 170, 8, 'F');
  doc.setTextColor(255, 255, 255);

  const headers = ['ID', 'Sala', 'Solicitante', 'Data', 'Horário', 'Estojo', 'Observação'];
  let x = 22;
  headers.forEach(h => {
    doc.text(h, x, y + 5);
    x += 25;
  });
  y += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  devolucoes.forEach((d, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const estojo = d.estojo === 'completo' ? 'Completo' : 'Incompleto';
    const dataFormatada = new Date(d.data_devolucao).toLocaleDateString('pt-BR');
    const obs = (d.observacao || '-').substring(0, 25) + (d.observacao?.length > 25 ? '...' : '');

    if (index % 2 === 1) {
      doc.setFillColor(248, 249, 255);
      doc.rect(20, y, 170, 7, 'F');
    }

    doc.text(d.id.toString(), 22, y + 4);
    doc.text(`Sala ${d.numero_sala}`, 47, y + 4);
    doc.text(d.solicitante.substring(0, 15), 72, y + 4);
    doc.text(dataFormatada, 97, y + 4);
    doc.text(d.horario, 122, y + 4);
    doc.text(estojo, 147, y + 4);
    doc.text(obs, 167, y + 4);

    y += 8;
  });

  doc.save(`relatorio-devolucoes-${inicio}-a-${fim}.pdf`);
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
    const select = document.getElementById('select-reserva');
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

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

// Exporta para o botão X do modal
window.fecharModalDevolucao = fecharModalDevolucao;