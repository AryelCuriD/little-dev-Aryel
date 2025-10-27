/**
 * index.js - Servidor Express para Projeto Little Dev
 * -------------------------------------------------
 * Estrutura organizada por seções:
 * 1. Configuração
 * 2. Rotas de Páginas (HTML)
 * 3. Rotas API - Salas
 * 4. Rotas API - Reservas
 * 5. Rotas API - Devolução
 * 6. Rotas API - Dashboard e Filtros
 * 7. Inicialização do servidor
 */
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // ← IMPORTANTE: memoryStorage
const express = require('express');
const path = require('path');
const util = require('util');
const connection = require('./models/db');

// Promisify para usar async/await com mysql
const query = util.promisify(connection.query).bind(connection);

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src')));

// ===============================================
// 1. ROTAS DE PÁGINAS (HTML)
// ===============================================
const pages = {
  '/': 'index.html',
  '/reservas': 'reservas.html',
  '/relatorios': 'relatorios.html',
  '/usuario': 'usuario.html'
};

Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'src', file));
  });
});

// ===============================================
// 2. ROTAS API - SALAS (FILTROS SIMPLES E IGUAIS)
// ===============================================
app.get('/api/salas', async (req, res) => {
  try {
    const { tipo, localizacao, capacidade } = req.query;

    let sql = `
      SELECT 
        id, numero_sala, tipo_sala, localizacao, capacidade,
        projetor, ar_condicionado, televisao, computador
      FROM salas
    `;
    const conditions = [];
    const values = [];

    if (tipo && tipo !== 'todos') {
      conditions.push('tipo_sala = ?');
      values.push(tipo);
    }
    if (localizacao && localizacao !== 'todos') {
      conditions.push('localizacao = ?');
      values.push(localizacao);
    }
    if (capacidade && capacidade !== 'todos') {
      conditions.push('capacidade = ?');
      values.push(capacidade);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY numero_sala';

    const results = await query(sql, values);
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar salas:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/salas', upload.single('imagem'), async (req, res) => {
  try {
    const {
      numero_sala,
      tipo_sala,
      localizacao,
      capacidade,
      projetor,
      ar_condicionado,
      televisao,
      computador
    } = req.body;

    const imagem = req.file ? req.file.buffer : null;
    const tipo_mime = req.file ? req.file.mimetype : null;

    // Validação
    if (!numero_sala || !tipo_sala || !localizacao || !capacidade) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const result = await query(
      `INSERT INTO salas 
       (numero_sala, tipo_sala, localizacao, capacidade, projetor, ar_condicionado, televisao, computador, imagem, tipo_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_sala,
        tipo_sala,
        localizacao,
        capacidade,
        projetor === 'true',
        ar_condicionado === 'true',
        televisao === 'true',
        computador === 'true',
        imagem,
        tipo_mime
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Sala criada!' });
  } catch (err) {
    console.error('Erro ao criar sala:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});


// === ROTA PUT CORRIGIDA ===
app.put('/api/salas/:id', upload.single('imagem'), async (req, res) => {
  try {
    const id = req.params.id;
    const {
      numero_sala,
      tipo_sala,
      localizacao,
      capacidade,
      projetor,
      ar_condicionado,
      televisao,
      computador
    } = req.body;

    // Validação
    if (!numero_sala || !tipo_sala || !localizacao || !capacidade) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // Converte strings "true"/"false" para boolean
    const toBool = (val) => val === 'true' || val === true;

    let sql = `UPDATE salas SET 
      numero_sala = ?, tipo_sala = ?, localizacao = ?, capacidade = ?,
      projetor = ?, ar_condicionado = ?, televisao = ?, computador = ?`;
    const values = [
      numero_sala,
      tipo_sala,
      localizacao,
      capacidade,
      toBool(projetor),
      toBool(ar_condicionado),
      toBool(televisao),
      toBool(computador)
    ];

    // Só atualiza imagem se houver arquivo
    if (req.file) {
      sql += `, imagem = ?, tipo_mime = ?`;
      values.push(req.file.buffer, req.file.mimetype);
    }

    sql += ` WHERE id = ?`;
    values.push(id);

    const result = await query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }

    res.json({ message: 'Sala atualizada com sucesso!' });
  } catch (err) {
    console.error('Erro ao editar sala:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Filtros com faixas de capacidade
app.get('/api/filtros-salas', async (req, res) => {
  try {
    const tipos = await query('SELECT DISTINCT tipo_sala FROM salas ORDER BY tipo_sala');
    const localizacoes = await query('SELECT DISTINCT localizacao FROM salas ORDER BY localizacao');

    const faixas = ['0-20', '20-40', '40+']; // opções fixas

    res.json({
      tipos: tipos.map(t => t.tipo_sala),
      localizacoes: localizacoes.map(l => l.localizacao),
      faixas
    });
  } catch (err) {
    console.error('Erro ao carregar filtros:', err);
    res.status(500).json({ error: 'Erro ao carregar opções de filtro' });
  }
});
// Rota para exibir imagem da sala
app.get('/api/salas/:id/imagem', async (req, res) => {
  try {
    const rows = await query('SELECT imagem, tipo_mime FROM salas WHERE id = ?', [req.params.id]);
    const sala = rows[0];
    if (!sala || !sala.imagem) {
      return res.status(404).send('Imagem não encontrada');
    }
    res.set('Content-Type', sala.tipo_mime || 'image/jpeg');
    res.send(sala.imagem);
  } catch (err) {
    console.error('Erro ao carregar imagem:', err);
    res.status(500).json({ error: 'Erro ao carregar imagem' });
  }
});

// ===============================================
// 3. ROTAS API - RESERVAS
// ===============================================
app.get('/api/reservas', async (req, res) => {
  try {
    const results = await query(`
      SELECT 
        r.id, r.solicitante, r.data_inicio, r.data_fim, r.status,
        s.numero_sala, s.localizacao, s.tipo_sala
      FROM reservas r
      JOIN salas s ON r.sala_id = s.id
      ORDER BY r.data_inicio DESC
    `);
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar reservas:', err);
    res.status(500).json({ error: 'Erro ao carregar reservas' });
  }
});


// Verificar se sala está ocupada em um dia e período
app.get('/api/reservas/verificar', async (req, res) => {
  const { sala_id, data, periodo } = req.query;

  if (!sala_id || !data || !periodo)
    return res.status(400).json({ error: 'Parâmetros insuficientes' });

  try {
    const horaInicio = periodo === 'manha' ? '08:00' : periodo === 'tarde' ? '14:00' : '19:00';
    const horaFim = periodo === 'manha' ? '12:00' : periodo === 'tarde' ? '18:00' : '22:00';

    const results = await query(
      `SELECT COUNT(*) AS total FROM reservas
       WHERE sala_id = ? 
         AND DATE(data_inicio) = ?
         AND (TIME(data_inicio) < ? AND TIME(data_fim) > ?)`,
      [sala_id, data, horaFim, horaInicio]
    );

    res.json({ ocupado: results[0].total > 0 });
  } catch (err) {
    console.error('Erro ao verificar disponibilidade:', err);
    res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
  }
});


app.post('/api/reservas', async (req, res) => {
  const { solicitante, data_inicio, data_fim, sala_id } = req.body;

  if (!solicitante || !data_inicio || !data_fim || !sala_id) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  try {
    const result = await query(
      `INSERT INTO reservas (solicitante, data_inicio, data_fim, sala_id) 
       VALUES (?, ?, ?, ?)`,
      [solicitante, data_inicio, data_fim, sala_id]
    );
    res.status(201).json({ id: result.insertId, message: 'Reserva criada' });
  } catch (err) {
    console.error('Erro ao criar reserva:', err);
    res.status(500).json({ error: 'Erro ao salvar reserva' });
  }
});

// ===============================================
// 4. ROTAS API - DEVOLUÇÃO DE ESTOJO
// ===============================================
app.get('/api/devolucao', async (req, res) => {
  try {
    const results = await query(`
      SELECT 
        d.id, d.estojo_completo, d.observacao,
        r.solicitante, r.data_inicio, r.data_fim,
        s.numero_sala
      FROM devolucao_estojo d
      JOIN reservas r ON d.reserva_id = r.id
      JOIN salas s ON r.sala_id = s.id
      ORDER BY d.id DESC
    `);
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar devoluções:', err);
    res.status(500).json({ error: 'Erro ao carregar devoluções' });
  }
});

app.post('/api/devolucao', async (req, res) => {
  const { reserva_id, estojo_completo, observacao } = req.body;

  if (!reserva_id) {
    return res.status(400).json({ error: 'ID da reserva é obrigatório' });
  }

  try {
    const result = await query(
      `INSERT INTO devolucao_estojo (reserva_id, estojo_completo, observacao) 
       VALUES (?, ?, ?)`,
      [reserva_id, estojo_completo || 'TRUE', observacao || '']
    );
    res.status(201).json({ id: result.insertId, message: 'Devolução registrada' });
  } catch (err) {
    console.error('Erro ao registrar devolução:', err);
    res.status(500).json({ error: 'Erro ao salvar devolução' });
  }
});

// ===============================================
// 5. ROTAS API - DASHBOARD
// ===============================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const [salasResult] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Sala%'");
    const [labsResult] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Laboratório%'");
    const [reservasAtivasResult] = await query("SELECT COUNT(*) AS total FROM reservas WHERE status = 'ativa'");
    const [devolucoesResult] = await query("SELECT COUNT(*) AS total FROM devolucao_estojo WHERE estojo_completo = 'FALSE'");

    res.json({
      salasDisponiveis: salasResult.total,
      labsDisponiveis: labsResult.total,
      reservasAtivas: reservasAtivasResult.total,
      devolucoesPendentes: devolucoesResult.total
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
});

// ===============================================
// 6. INICIALIZAÇÃO DO SERVIDOR
// ===============================================
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`\nServidor rodando em http://localhost:${PORT}`);
  console.log(`Acesse as páginas:`);
  console.log(`  • Home: http://localhost:${PORT}`);
  console.log(`  • Reservas: http://localhost:${PORT}/reservas`);
  console.log(`  • Relatórios: http://localhost:${PORT}/relatorios`);
  console.log(`  • Usuário: http://localhost:${PORT}/usuario\n`);
});