/**
 * index.js - Servidor Express para Projeto Little Dev
 * -------------------------------------------------
 * Estrutura organizada por seções:
 * 1. Configuração
 * 2. Rotas de Páginas (HTML)
 * 3. Rotas API - Salas
 * 4. Rotas API - Reservas (PERÍODO + INTERVALO)
 * 5. Rotas API - Devolução
 * 6. Rotas API - Dashboard e Filtros
 * 7. Inicialização do servidor
 */
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const express = require('express');
const path = require('path');
const util = require('util');
const connection = require('./models/db');

// === MOMENT COM FUSO BRASIL ===
let moment;
try {
  moment = require('moment-timezone');
  moment.locale('pt-br');
} catch (err) {
  console.warn('moment-timezone não instalado. Usando horário do servidor.');
  moment = null;
}

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
// 2. ROTAS API - SALAS
// ===============================================
app.get('/api/salas', async (req, res) => {
  try {
    const { tipo, localizacao, capacidade } = req.query;
    let sql = `SELECT id, numero_sala, tipo_sala, localizacao, capacidade,
                      projetor, ar_condicionado, televisao, computador
               FROM salas`;
    const conditions = [];
    const values = [];

    if (tipo && tipo !== 'todos') { conditions.push('tipo_sala = ?'); values.push(tipo); }
    if (localizacao && localizacao !== 'todos') { conditions.push('localizacao = ?'); values.push(localizacao); }
    if (capacidade && capacidade !== 'todos') { conditions.push('capacidade = ?'); values.push(capacidade); }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY numero_sala';

    const results = await query(sql, values);
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar salas:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// === STATUS REAL DAS SALAS (AGORA) ===
app.get('/api/dashboard/salas-status', async (req, res) => {
  try {
    let agora;
    if (moment) {
      agora = moment.tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
    } else {
      agora = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    const reservasAtivas = await query(`
      SELECT DISTINCT r.sala_id
      FROM reservas r
      WHERE r.data_inicio <= ? AND r.data_fim >= ?
    `, [agora, agora]);

    const ocupadas = new Set(reservasAtivas.map(r => r.sala_id));
    const todasSalas = await query('SELECT id FROM salas');
    const status = todasSalas.map(sala => ({
      id: sala.id,
      disponivel: !ocupadas.has(sala.id)
    }));

    res.json(status);
  } catch (err) {
    console.error('Erro crítico no status:', err);
    res.status(500).json([]);
  }
});

// === OPÇÕES DE FILTRO (LOCALIZAÇÃO E TIPO) ===
app.get('/api/salas/opcoes', async (req, res) => {
  try {
    const locResult = await query('SELECT DISTINCT localizacao FROM salas WHERE localizacao IS NOT NULL ORDER BY localizacao');
    const tipoResult = await query('SELECT DISTINCT tipo_sala FROM salas WHERE tipo_sala IS NOT NULL ORDER BY tipo_sala');

    const localizacoes = locResult.map(r => r.localizacao).filter(Boolean);
    const tipos = tipoResult.map(r => r.tipo_sala).filter(Boolean);

    res.json({ localizacoes, tipos });
  } catch (err) {
    console.error('Erro ao buscar opções:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST - ADICIONAR SALA
app.post('/api/salas', upload.single('imagem'), async (req, res) => {
  try {
    const { numero_sala, tipo_sala, localizacao, capacidade, projetor, ar_condicionado, televisao, computador } = req.body;
    const imagem = req.file ? req.file.buffer : null;
    const tipo_mime = req.file ? req.file.mimetype : null;

    if (!numero_sala || !tipo_sala || !localizacao || !capacidade) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const result = await query(
      `INSERT INTO salas 
       (numero_sala, tipo_sala, localizacao, capacidade, projetor, ar_condicionado, televisao, computador, imagem, tipo_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_sala, tipo_sala, localizacao, capacidade,
        projetor === 'true', ar_condicionado === 'true', televisao === 'true', computador === 'true',
        imagem, tipo_mime
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Sala criada!' });
  } catch (err) {
    console.error('Erro ao criar sala:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT - EDITAR SALA
app.put('/api/salas/:id', upload.single('imagem'), async (req, res) => {
  try {
    const id = req.params.id;
    const { numero_sala, tipo_sala, localizacao, capacidade, projetor, ar_condicionado, televisao, computador } = req.body;

    if (!numero_sala || !tipo_sala || !localizacao || !capacidade) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const toBool = (val) => val === 'true' || val === true;

    let sql = `UPDATE salas SET numero_sala = ?, tipo_sala = ?, localizacao = ?, capacidade = ?,
               projetor = ?, ar_condicionado = ?, televisao = ?, computador = ?`;
    const values = [numero_sala, tipo_sala, localizacao, capacidade,
                    toBool(projetor), toBool(ar_condicionado), toBool(televisao), toBool(computador)];

    if (req.file) {
      sql += `, imagem = ?, tipo_mime = ?`;
      values.push(req.file.buffer, req.file.mimetype);
    }

    sql += ` WHERE id = ?`;
    values.push(id);

    const result = await query(sql, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Sala não encontrada' });

    res.json({ message: 'Sala atualizada!' });
  } catch (err) {
    console.error('Erro ao editar sala:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// FILTROS
app.get('/api/filtros-salas', async (req, res) => {
  try {
    const tipos = await query('SELECT DISTINCT tipo_sala FROM salas ORDER BY tipo_sala');
    const localizacoes = await query('SELECT DISTINCT localizacao FROM salas ORDER BY localizacao');
    const faixas = ['0-20', '20-40', '40+'];

    res.json({
      tipos: tipos.map(t => t.tipo_sala),
      localizacoes: localizacoes.map(l => l.localizacao),
      faixas
    });
  } catch (err) {
    console.error('Erro ao carregar filtros:', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// IMAGEM COM PLACEHOLDER
app.get('/api/salas/:id/imagem', async (req, res) => {
  try {
    const [row] = await query('SELECT imagem, tipo_mime FROM salas WHERE id = ?', [req.params.id]);
    if (!row || !row.imagem) {
      return res.sendFile(path.join(__dirname, 'src', 'imgs', 'sala-placeholder.jpg'));
    }
    res.set('Content-Type', row.tipo_mime || 'image/jpeg');
    res.send(row.imagem);
  } catch (err) {
    console.error('Erro ao carregar imagem:', err);
    res.sendFile(path.join(__dirname, 'src', 'imgs', 'sala-placeholder.jpg'));
  }
});

// ===============================================
// 3. ROTAS API - RESERVAS
// ===============================================

// === VERIFICAR DISPONIBILIDADE POR INTERVALO ===
app.get('/api/reservas/verificar-range', async (req, res) => {
  const { sala_id, inicio, fim } = req.query;
  if (!sala_id || !inicio || !fim) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: sala_id, inicio, fim' });
  }

  try {
    const [row] = await query(`
      SELECT 1 FROM reservas
      WHERE sala_id = ? AND (
        (data_inicio < ? AND data_fim > ?) OR
        (data_inicio < ? AND data_fim > ?) OR
        (data_inicio >= ? AND data_fim <= ?) OR
        (data_inicio <= ? AND data_fim >= ?)
      )
    `, [sala_id, fim, inicio, fim, inicio, inicio, fim, inicio, fim]);

    res.json({ ocupado: !!row });
  } catch (err) {
    console.error('Erro ao verificar intervalo:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// === CRIAR RESERVA ===
app.post('/api/reservas', async (req, res) => {
  const { solicitante, data_inicio, data_fim, sala_id } = req.body;
  if (!solicitante || !data_inicio || !data_fim || !sala_id) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  try {
    const [conflito] = await query(`
      SELECT 1 FROM reservas
      WHERE sala_id = ? AND (
        (data_inicio < ? AND data_fim > ?) OR
        (data_inicio < ? AND data_fim > ?) OR
        (data_inicio >= ? AND data_fim <= ?)
      )
    `, [sala_id, data_fim, data_inicio, data_fim, data_inicio, data_inicio, data_fim]);

    if (conflito) {
      return res.status(409).json({ error: 'Conflito de horário: sala já reservada neste intervalo' });
    }

    const result = await query(
      `INSERT INTO reservas (solicitante, data_inicio, data_fim, sala_id) VALUES (?, ?, ?, ?)`,
      [solicitante, data_inicio, data_fim, sala_id]
    );

    res.status(201).json({ id: result.insertId, message: 'Reserva criada com sucesso' });
  } catch (err) {
    console.error('Erro ao criar reserva:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===============================================
// 4. ROTAS API - DEVOLUÇÃO (USANDO devolucao_estojo)
// ===============================================

// === LISTAR DEVOLUÇÕES ===
app.get('/api/devolucoes', async (req, res) => {
  try {
    const devolucoes = await query(`
      SELECT 
        de.id,
        de.reserva_id,
        de.estojo_completo,
        de.observacao,
        r.solicitante,
        r.data_inicio,
        r.data_fim,
        s.numero_sala,
        DATE_FORMAT(r.data_inicio, '%Y-%m-%d') AS data_devolucao,
        CONCAT(
          DATE_FORMAT(r.data_inicio, '%H:%i'), ' - ',
          DATE_FORMAT(r.data_fim, '%H:%i')
        ) AS horario
      FROM devolucao_estojo de
      JOIN reservas r ON de.reserva_id = r.id
      JOIN salas s ON r.sala_id = s.id
      ORDER BY de.id DESC
    `);

    // Converte 'TRUE'/'FALSE' para 'completo'/'incompleto'
    const formatadas = devolucoes.map(d => ({
      ...d,
      estojo: d.estojo_completo === 'TRUE' ? 'completo' : 'incompleto'
    }));

    res.json(formatadas);
  } catch (err) {
    console.error('Erro ao listar devoluções:', err);
    res.status(500).json([]);
  }
});

// === CRIAR DEVOLUÇÃO ===
app.post('/api/devolucoes', async (req, res) => {
  const { reserva_id, estojo, observacao } = req.body;

  if (!reserva_id || !estojo) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  const estojo_completo = estojo === 'completo' ? 'TRUE' : 'FALSE';

  try {
    const [existente] = await query('SELECT 1 FROM devolucao_estojo WHERE reserva_id = ?', [reserva_id]);
    if (existente) {
      return res.status(409).json({ error: 'Devolução já registrada' });
    }

    const result = await query(
      `INSERT INTO devolucao_estojo (reserva_id, estojo_completo, observacao) VALUES (?, ?, ?)`,
      [reserva_id, estojo_completo, observacao || null]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Erro ao criar devolução:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// === RESERVAS PENDENTES DE DEVOLUÇÃO ===
app.get('/api/reservas/pendentes-devolucao', async (req, res) => {
  try {
    const pendentes = await query(`
      SELECT 
        r.id,
        r.sala_id,
        s.numero_sala,
        r.solicitante,
        r.data_inicio,
        r.data_fim,
        DATE_FORMAT(r.data_inicio, '%H:%i') AS hora_inicio,
        DATE_FORMAT(r.data_fim, '%H:%i') AS hora_fim
      FROM reservas r
      JOIN salas s ON r.sala_id = s.id
      LEFT JOIN devolucao_estojo de ON r.id = de.reserva_id
      WHERE r.data_fim < NOW()
        AND de.id IS NULL
      ORDER BY r.data_inicio DESC
    `);

    const formatadas = pendentes.map(p => ({
      id: p.id,
      numero_sala: p.numero_sala,
      solicitante: p.solicitante,
      data_inicio: p.data_inicio,
      horario: `${p.hora_inicio} - ${p.hora_fim}`
    }));

    res.json(formatadas);
  } catch (err) {
    console.error('Erro ao buscar reservas pendentes:', err);
    res.status(500).json([]);
  }
});
// ===============================================
// 5. DASHBOARD
// ===============================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const [salas] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Sala%'");
    const [labs] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Laboratório%'");
    const [ativas] = await query("SELECT COUNT(*) AS total FROM reservas r WHERE r.data_inicio <= NOW() AND r.data_fim >= NOW()");
    const [pendentes] = await query("SELECT COUNT(*) AS total FROM devolucoes WHERE estojo = 'incompleto'");

    res.json({
      salasDisponiveis: salas.total,
      labsDisponiveis: labs.total,
      reservasAtivas: ativas.total,
      devolucoesPendentes: pendentes.total
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===============================================
// 6. INICIALIZAÇÃO
// ===============================================
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`\nServidor rodando em http://localhost:${PORT}`);
  console.log(`  • Home: http://localhost:${PORT}`);
  console.log(`  • Reservas: http://localhost:${PORT}/reservas\n`);
});