/**
 * index.js - Servidor Express para Projeto Little Dev
 * -------------------------------------------------
 * Estrutura organizada por seções:
 * 1. Configuração
 * 2. Rotas de Páginas (HTML)
 * 3. Rotas API - Salas
 * 4. Rotas API - Reservas
 * 5. Rotas API - Devolução
 * 6. Rotas API - Dashboard e Próximas Reservas
 * 7. Inicialização do servidor
 */

const express = require('express');
const path = require('path');
const util = require('util');
const multer = require('multer');
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

// === CONFIGURAÇÃO DE UPLOAD ===
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const tipos = /jpeg|jpg|png|gif/;
    const ext = tipos.test(file.originalname.toLowerCase());
    const mime = tipos.test(file.mimetype);
    cb(null, ext && mime);
  }
});

const query = util.promisify(connection.query).bind(connection);
const app = express();

// === MIDDLEWARES ===
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// ✅ OPÇÕES PARA SELECTS (tipo, localização, capacidade)
app.get('/api/salas/opcoes', async (req, res) => {
  try {
    const tipos = await query(
      'SELECT DISTINCT tipo_sala FROM salas WHERE tipo_sala IS NOT NULL ORDER BY tipo_sala'
    );
    const localizacoes = await query(
      'SELECT DISTINCT localizacao FROM salas WHERE localizacao IS NOT NULL ORDER BY localizacao'
    );
    const capacidades = await query(
      'SELECT DISTINCT capacidade FROM salas WHERE capacidade IS NOT NULL ORDER BY capacidade'
    );

    res.json({
      tipos: tipos.map(t => t.tipo_sala),
      localizacoes: localizacoes.map(l => l.localizacao),
      capacidades: capacidades.map(c => c.capacidade)
    });
  } catch (err) {
    console.error('Erro ao carregar opções:', err);
    res.status(500).json({ error: 'Erro interno ao carregar opções' });
  }
});

// LISTAR SALAS COM FILTROS
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
    res.status(500).json({ error: 'Erro interno ao buscar salas' });
  }
});

// BUSCAR SALA POR ID
app.get('/api/salas/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const [sala] = await query(`
      SELECT id, numero_sala, tipo_sala, localizacao, capacidade,
             projetor, ar_condicionado, televisao, computador
      FROM salas WHERE id = ?
    `, [id]);

    if (!sala) return res.status(404).json({ error: 'Sala não encontrada' });
    res.json(sala);
  } catch (err) {
    console.error('Erro ao buscar sala:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// FILTROS PARA SELECTS
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
    res.status(500).json({ error: 'Erro ao carregar filtros' });
  }
});

// CRIAR SALA
app.post('/api/salas', upload.single('imagem'), async (req, res) => {
  try {
    const { numero_sala, tipo_sala, localizacao, capacidade, projetor, ar_condicionado, televisao, computador } = req.body;
    const imagem = req.file ? req.file.buffer : null;
    const tipo_mime = req.file ? req.file.mimetype : null;

    if (!numero_sala || !tipo_sala || !localizacao || !capacidade) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // Verifica se número da sala já existe
    const [existente] = await query('SELECT 1 FROM salas WHERE numero_sala = ?', [numero_sala]);
    if (existente) {
      return res.status(409).json({ error: 'Já existe uma sala com este número' });
    }

    const result = await query(
      `INSERT INTO salas 
       (numero_sala, tipo_sala, localizacao, capacidade, projetor, ar_condicionado, televisao, computador, imagem, tipo_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_sala, tipo_sala, localizacao, capacidade,
        projetor === 'true' || projetor === true,
        ar_condicionado === 'true' || ar_condicionado === true,
        televisao === 'true' || televisao === true,
        computador === 'true' || computador === true,
        imagem, tipo_mime
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Sala criada com sucesso!' });
  } catch (err) {
    console.error('Erro ao criar sala:', err);
    res.status(500).json({ error: 'Erro interno ao criar sala' });
  }
});

// EDITAR SALA
app.put('/api/salas/:id', upload.single('imagem'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { numero_sala, tipo_sala, localizacao, capacidade, projetor, ar_condicionado, televisao, computador } = req.body;

    if (!numero_sala || !tipo_sala || !localizacao || !capacidade) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // Verifica duplicidade de número (exceto a própria sala)
    const [duplicado] = await query('SELECT 1 FROM salas WHERE numero_sala = ? AND id != ?', [numero_sala, id]);
    if (duplicado) {
      return res.status(409).json({ error: 'Já existe outra sala com este número' });
    }

    const toBool = (val) => val === true || val === 'true' || val === '1';

    let sql = `UPDATE salas SET numero_sala = ?, tipo_sala = ?, localizacao = ?, capacidade = ?,
               projetor = ?, ar_condicionado = ?, televisao = ?, computador = ?`;
    const values = [
      numero_sala, tipo_sala, localizacao, capacidade,
      toBool(projetor), toBool(ar_condicionado), toBool(televisao), toBool(computador)
    ];

    if (req.file) {
      sql += `, imagem = ?, tipo_mime = ?`;
      values.push(req.file.buffer, req.file.mimetype);
    }

    sql += ` WHERE id = ?`;
    values.push(id);

    const result = await query(sql, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Sala não encontrada' });

    res.json({ message: 'Sala atualizada com sucesso!' });
  } catch (err) {
    console.error('Erro ao editar sala:', err);
    res.status(500).json({ error: 'Erro interno ao editar sala' });
  }
});

// IMAGEM DA SALA
app.get('/api/salas/:id/imagem', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const [row] = await query('SELECT imagem, tipo_mime FROM salas WHERE id = ?', [id]);
    if (!row || !row.imagem) {
      return res.sendFile(path.join(__dirname, 'src', 'imgs', 'sala-placeholder.jpg'));
    }
    res.set('Content-Type', row.tipo_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(row.imagem);
  } catch (err) {
    console.error('Erro ao carregar imagem:', err);
    res.sendFile(path.join(__dirname, 'src', 'imgs', 'sala-placeholder.jpg'));
  }
});

// STATUS DAS SALAS (OCUPADA/DISPONÍVEL)
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
    console.error('Erro no status das salas:', err);
    res.status(500).json([]);
  }
});

// ===============================================
// 3. ROTAS API - RESERVAS
// ===============================================

// VERIFICAR DISPONIBILIDADE POR INTERVALO
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

// CRIAR RESERVA
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
// 4. ROTAS API - DEVOLUÇÃO (estojo)
// ===============================================

// LISTAR DEVOLUÇÕES
app.get('/api/devolucoes', async (req, res) => {
  const { inicio, fim, sala_id } = req.query;

  try {
    let sql = `
      SELECT 
        de.id,
        de.reserva_id,
        de.estojo_completo,
        de.observacao,
        r.solicitante,
        r.data_inicio,
        r.data_fim,
        s.numero_sala,
        DATE(r.data_inicio) AS data_devolucao,
        CONCAT(
          TIME_FORMAT(r.data_inicio, '%H:%i'), ' - ',
          TIME_FORMAT(r.data_fim, '%H:%i')
        ) AS horario
      FROM devolucao_estojo de
      JOIN reservas r ON de.reserva_id = r.id
      JOIN salas s ON r.sala_id = s.id
      WHERE 1=1
    `;

    const values = [];

    if (inicio) {
      sql += ' AND DATE(r.data_inicio) >= ?';
      values.push(inicio);
    }
    if (fim) {
      sql += ' AND DATE(r.data_inicio) <= ?';
      values.push(fim);
    }
    if (sala_id) {
      sql += ' AND r.sala_id = ?';
      values.push(sala_id);
    }

    sql += ' ORDER BY de.id DESC';

    const devolucoes = await query(sql, values);

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

// CRIAR DEVOLUÇÃO
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

    res.status(201).json({ id: result.insertId, message: 'Devolução registrada!' });
  } catch (err) {
    console.error('Erro ao criar devolução:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// RESERVAS PENDENTES DE DEVOLUÇÃO
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
// 5. DASHBOARD + PRÓXIMAS RESERVAS
// ===============================================

// PRÓXIMAS RESERVAS
app.get('/api/reservas/proximas', async (req, res) => {
  try {
    const agora = new Date();
    const hoje = agora.toISOString().split('T')[0];

    const proximas = await query(`
      SELECT 
        r.id,
        r.solicitante,
        s.numero_sala,
        DATE_FORMAT(r.data_inicio, '%d/%m') AS dia,
        DATE_FORMAT(r.data_inicio, '%H:%i') AS hora_inicio,
        DATE_FORMAT(r.data_fim, '%H:%i') AS hora_fim,
        CONCAT(DATE_FORMAT(r.data_inicio, '%d/%m'), ' - ', DATE_FORMAT(r.data_inicio, '%H:%i'), ' - ', DATE_FORMAT(r.data_fim, '%H:%i')) AS horario_completo,
        CASE 
          WHEN r.data_inicio > NOW() THEN 'futura'
          WHEN r.data_inicio <= NOW() AND r.data_fim >= NOW() THEN 'ativa'
          ELSE 'encerrada'
        END AS status
      FROM reservas r
      JOIN salas s ON r.sala_id = s.id
      WHERE r.data_fim > NOW()
        AND DATE(r.data_inicio) >= ?
      ORDER BY r.data_inicio ASC
    `, [hoje]);

    res.json(proximas);
  } catch (err) {
    console.error('Erro ao buscar reservas ativas/futuras:', err);
    res.status(500).json([]);
  }
});

// DASHBOARD PRINCIPAL
app.get('/api/dashboard', async (req, res) => {
  try {
    const [salasResult] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE '%aula%' OR tipo_sala LIKE 'Sala%'");
    const [labsResult] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE '%aborat%'");

    const [ativasResult] = await query(`
      SELECT COUNT(*) AS total 
      FROM reservas 
      WHERE data_inicio <= NOW() AND data_fim >= NOW()
    `);

    const [pendentesResult] = await query(`
      SELECT COUNT(*) AS total 
      FROM reservas r
      LEFT JOIN devolucao_estojo de ON r.id = de.reserva_id
      WHERE r.data_fim < NOW() AND de.id IS NULL
    `);

    res.json({
      salasDisponiveis: salasResult.total,
      labsDisponiveis: labsResult.total,
      reservasAtivas: ativasResult.total,
      devolucoesPendentes: pendentesResult.total
    });
  } catch (err) {
    console.error('Erro crítico no dashboard:', err);
    res.status(500).json({
      salasDisponiveis: 0,
      labsDisponiveis: 0,
      reservasAtivas: 0,
      devolucoesPendentes: 0
    });
  }
});

// ===============================================
// 6. INICIALIZAÇÃO DO SERVIDOR
// ===============================================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`  • Home: http://localhost:${PORT}`);
  console.log(`  • Reservas: http://localhost:${PORT}/reservas`);
  console.log(`  • Relatórios: http://localhost:${PORT}/relatorios`);
});

// Tratamento de erro global
process.on('unhandledRejection', (err) => {
  console.error('Erro não tratado:', err);
});