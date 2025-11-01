let salas = [];
let salaSelecionada = null;
let dataSelecionada = null;
let intervaloAtualizacao = null;

// ===============================================
// DOM E NAVEGAÇÃO
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
  setActivePage();

  if (window.location.pathname === '/') {
    carregarEstatisticasDashboard();
  }

  if (window.location.pathname === '/reservas') {
    carregarFiltros();
    carregarSalas();
    iniciarAtualizacaoAutomatica();
  }
});

function setActivePage() {
  const current = window.location.pathname.split('/').pop() || 'home';
  document.querySelectorAll('.paginas a').forEach(link => {
    link.classList.toggle('active', link.dataset.page === current);
  });
}

// ===============================================
// RESERVAS
// ===============================================
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

// ===============================================
// CALENDÁRIO E MODAL
// ===============================================
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

// ===============================================
// HORÁRIOS POR INTERVALO
// ===============================================
function gerarHorarios() {
  const horarios = [];
  for (let h = 7; h <= 18; h++) {
    if (h !== 12) {
      horarios.push(`${String(h).padStart(2, '0')}:00`);
    }
    if (h < 18 && h !== 12) {
      horarios.push(`${String(h).padStart(2, '0')}:30`);
    }
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
    horarios.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      select.appendChild(opt);
    });
  });

  inicioSelect.value = '';
  fimSelect.value = '';
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
    const opt = document.createElement('option');
    opt.value = horarios[i];
    opt.textContent = horarios[i];
    fimSelect.appendChild(opt);
  }
  fimSelect.disabled = false;
}

// ===============================================
// MODAL DE DETALHES
// ===============================================
async function atualizarStatusDisponibilidade() {
  const inicio = document.getElementById('hora-inicio')?.value;
  const fim = document.getElementById('hora-fim')?.value;
  const statusTexto = document.getElementById('modal-status-texto');
  const statusIcone = document.getElementById('modal-status-icone');
  const statusDiv = document.querySelector('.modal-status');

  if (!dataSelecionada) {
    statusTexto.textContent = 'Selecione uma data';
    statusIcone.src = './imgs/check.png';
    statusDiv.classList.remove('indisponivel');
    return;
  }

  if (!inicio || !fim) {
    statusTexto.textContent = 'Selecione horário completo';
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
    console.error('Erro ao verificar horário:', err);
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

  // === CORREÇÃO: CHAMA ANTES DE ACESSAR OS SELECTS ===
  inicializarHorarios();
  atualizarStatusDisponibilidade();

  document.getElementById("modal-detalhes").style.display = "flex";
}

// === EDITAR SALA ===
let salaEditando = null;

function abrirModalEditar() {
  if (!salaSelecionada) {
    alert('Nenhuma sala selecionada para edição.');
    return;
  }

  salaEditando = salaSelecionada;

  const el = (id) => {
    const elem = document.getElementById(id);
    if (!elem) {
      console.warn(`Elemento #${id} não encontrado`);
      return null;
    }
    return elem;
  };

  const numero = el('novo-numero');
  const capacidade = el('novo-capacidade');
  const localizacao = el('novo-localizacao');
  const tipo = el('novo-tipo');

  if (numero) numero.value = salaEditando.numero_sala;
  if (capacidade) capacidade.value = salaEditando.capacidade;
  if (localizacao) localizacao.value = salaEditando.localizacao;
  if (tipo) tipo.value = salaEditando.tipo_sala;

  const setBolinha = (id, valor) => {
    const b = el(id);
    if (b) b.classList.toggle('preenchida', valor);
  };
  setBolinha('check-projetor', salaEditando.projetor);
  setBolinha('check-ar', salaEditando.ar_condicionado);
  setBolinha('check-tv', salaEditando.televisao);
  setBolinha('check-pc', salaEditando.computador);

  const preview = el('preview-imagem');
  if (preview) {
    preview.src = `/api/salas/${salaEditando.id}/imagem`;
  }

  const titulo = el('modal-titulo-sala');
  if (titulo) titulo.textContent = `Editar Sala ${salaEditando.numero_sala}`;

  const btn = el('btn-acao-sala');
  if (btn) {
    btn.textContent = 'Salvar Alterações';
    btn.onclick = salvarEdicao;
  }

  const modal = document.getElementById('modal-adicionar-sala');
  if (modal) {
    modal.style.display = 'flex';
    carregarOpcoesFiltros();
  }
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
    alert('Preencha todos os campos obrigatórios!');
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
      fecharModal();
      carregarSalas();
      carregarEstatisticasDashboard();
    } else {
      const erro = await res.text();
      alert('Erro ao salvar: ' + erro);
    }
  } catch (err) {
    console.error('Erro de rede:', err);
    alert('Erro de conexão.');
  }
}

async function carregarOpcoesFiltros() {
  try {
    const res = await fetch('/api/salas/opcoes');
    if (!res.ok) throw new Error('Falha ao carregar opções');

    const { localizacoes, tipos } = await res.json();

    const selectLocalizacao = document.getElementById('novo-localizacao');
    const selectTipo = document.getElementById('novo-tipo');

    if (selectLocalizacao) {
      selectLocalizacao.innerHTML = '<option value="">Escolha uma opção</option>';
      localizacoes.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = loc;
        selectLocalizacao.appendChild(opt);
      });
    }

    if (selectTipo) {
      selectTipo.innerHTML = '<option value="">Escolha uma opção</option>';
      tipos.forEach(tipo => {
        const opt = document.createElement('option');
        opt.value = tipo;
        opt.textContent = tipo;
        selectTipo.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Erro ao carregar opções:', err);
    alert('Erro ao carregar opções de filtro.');
  }
}

function fecharModal() {
  document.getElementById("modal-detalhes").style.display = "none";
}

// ===============================================
// FAZER RESERVA COM HORÁRIO ESPECÍFICO
// ===============================================
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
      alert('Reserva realizada com sucesso!');
      fecharModal();
      carregarSalas();
      carregarEstatisticasDashboard();
    } else {
      alert('Erro ao reservar.');
    }
  } catch (err) {
    alert('Erro de conexão.');
  }
}

// ===============================================
// ATUALIZAÇÃO AUTOMÁTICA
// ===============================================
function iniciarAtualizacaoAutomatica() {
  if (intervaloAtualizacao) clearInterval(intervaloAtualizacao);
  intervaloAtualizacao = setInterval(() => {
    if (window.location.pathname === '/reservas') {
      carregarSalas();
    }
  }, 30000);
}

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
    console.error('Erro no dashboard:', err);
  }
}

function fecharModalAdicionar() {
  const modal = document.getElementById('modal-adicionar-sala');
  if (modal) modal.style.display = 'none';

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

  const btn = document.getElementById('btn-acao-sala');
  if (btn) {
    btn.textContent = 'Adicionar Sala';
    btn.onclick = adicionarSala;
  }
}

function toggleBolinha(element) {
  element.classList.toggle('preenchida');
}

function previewImagem(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('preview-imagem');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = (e) => preview.src = e.target.result;
    reader.readAsDataURL(file);
  }
}

function abrirModalAdicionar() {
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

  const titulo = document.getElementById('modal-titulo-sala');
  if (titulo) titulo.textContent = 'Adicionar Nova Sala';

  const btn = document.getElementById('btn-acao-sala');
  if (btn) {
    btn.textContent = 'Adicionar Sala';
    btn.onclick = adicionarSala;
  }

  carregarOpcoesFiltros().then(() => {
    const modal = document.getElementById('modal-adicionar-sala');
    if (modal) modal.style.display = 'flex';
  }).catch(err => {
    console.error('Erro ao abrir modal:', err);
    alert('Erro ao carregar opções.');
  });
}

let enviandoSala = false;

async function adicionarSala() {
  if (enviandoSala) return;

  const btn = document.getElementById('btn-acao-sala');
  if (!btn) {
    console.error('Botão btn-acao-sala não encontrado!');
    alert('Erro: botão não encontrado.');
    return;
  }

  const textoOriginal = btn.textContent.trim();
  btn.textContent = 'Enviando...';
  btn.disabled = true;
  enviandoSala = true;

  const numero = document.getElementById('novo-numero')?.value.trim();
  const capacidade = document.getElementById('novo-capacidade')?.value;
  const localizacao = document.getElementById('novo-localizacao')?.value;
  const tipo = document.getElementById('novo-tipo')?.value;
  const file = document.getElementById('upload-imagem')?.files[0];

  const projetor = document.getElementById('check-projetor')?.classList.contains('preenchida');
  const ar = document.getElementById('check-ar')?.classList.contains('preenchida');
  const tv = document.getElementById('check-tv')?.classList.contains('preenchida');
  const pc = document.getElementById('check-pc')?.classList.contains('preenchida');

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
      carregarSalas();
      carregarEstatisticasDashboard();
    } else {
      const erro = await res.text();
      alert('Erro: ' + erro);
    }
  } catch (err) {
    console.error('Erro:', err);
    alert('Erro de conexão.');
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
    enviandoSala = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarReservasConcluidas();

  document.getElementById('btn-baixar-relatorio').onclick = () => {
    const inicio = document.getElementById('data-inicio').value;
    const fim = document.getElementById('data-fim').value;
    const erro = document.getElementById('erro-filtro');

    if (!inicio || !fim || inicio > fim) {
      erro.style.display = 'block';
      return;
    }
    erro.style.display = 'none';

    // Futuro: chamar /api/relatorios/devolucao?inicio=...&fim=...
    window.open(`/api/relatorios/devolucao?inicio=${inicio}&fim=${fim}`, '_blank');
  };
});

async function carregarReservasConcluidas() {
  try {
    const res = await fetch('/api/reservas/concluidas');
    const reservas = await res.json();

    const tbody = document.querySelector('#tabela-reservas tbody');
    const semDados = document.getElementById('sem-dados');

    if (reservas.length === 0) {
      semDados.style.display = 'block';
      tbody.innerHTML = '';
      return;
    }

    semDados.style.display = 'none';
    tbody.innerHTML = reservas.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>Sala ${r.numero_sala}</td>
        <td>${r.solicitante}</td>
        <td>${new Date(r.data_inicio).toLocaleDateString('pt-BR')}</td>
        <td>${r.horario}</td>
        <td><span class="status-concluida">Concluída</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Erro ao carregar reservas:', err);
  }
}