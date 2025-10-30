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
    // === HORÁRIO CORRETO (BRASIL) ===
    let agora;
    if (moment) {
      agora = moment.tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
    } else {
      agora = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    console.log('Horário verificado:', agora);

    // === RESERVAS ATIVAS AGORA ===
    let reservasAtivas = [];
    try {
      reservasAtivas = await query(`
        SELECT DISTINCT r.sala_id
        FROM reservas r
        WHERE r.data_inicio <= ? AND r.data_fim >= ?
      `, [agora, agora]);
    } catch (err) {
      console.error('Erro na query de reservas:', err);
    }

    const ocupadas = new Set(reservasAtivas.map(r => r.sala_id));
    console.log('Salas ocupadas:', Array.from(ocupadas));

    // === TODAS AS SALAS ===
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
app.get('/api/reservas/verificar', async (req, res) => {
  const { sala_id, data, periodo } = req.query;
  if (!sala_id || !data || !periodo) return res.status(400).json({ error: 'Parâmetros insuficientes' });

  const horarios = {
    manha: { inicio: '08:00:00', fim: '12:00:00' },
    tarde: { inicio: '14:00:00', fim: '18:00:00' },
    noite: { inicio: '19:00:00', fim: '22:00:00' }
  };

  const { inicio, fim } = horarios[periodo] || {};
  if (!inicio || !fim) return res.status(400).json({ error: 'Período inválido' });

  const dataInicio = `${data} ${inicio}`;
  const dataFim = `${data} ${fim}`;

  try {
    const [row] = await query(`
      SELECT 1 FROM reservas
      WHERE sala_id = ? AND (
        (data_inicio < ? AND data_fim > ?) OR
        (data_inicio < ? AND data_fim > ?)
      )
    `, [sala_id, dataFim, dataInicio, dataFim, dataInicio]);

    res.json({ ocupado: !!row });
  } catch (err) {
    console.error('Erro ao verificar:', err);
    res.status(500).json({ error: 'Erro' });
  }
});

app.post('/api/reservas', async (req, res) => {
  const { solicitante, data_inicio, data_fim, sala_id } = req.body;
  if (!solicitante || !data_inicio || !data_fim || !sala_id) {
    return res.status(400).json({ error: 'Campos obrigatórios' });
  }

  try {
    const result = await query(
      `INSERT INTO reservas (solicitante, data_inicio, data_fim, sala_id) VALUES (?, ?, ?, ?)`,
      [solicitante, data_inicio, data_fim, sala_id]
    );
    res.status(201).json({ id: result.insertId, message: 'Reserva criada' });
  } catch (err) {
    console.error('Erro ao criar reserva:', err);
    res.status(500).json({ error: 'Erro ao salvar' });
  }
});

// ===============================================
// 4. DASHBOARD
// ===============================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const [salas] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Sala%'");
    const [labs] = await query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Laboratório%'");
    const [ativas] = await query("SELECT COUNT(*) AS total FROM reservas r WHERE r.data_inicio <= NOW() AND r.data_fim >= NOW()");
    const [pendentes] = await query("SELECT COUNT(*) AS total FROM devolucao_estojo WHERE estojo_completo = 'FALSE'");

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
// 5. INICIALIZAÇÃO
// ===============================================
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`\nServidor rodando em http://localhost:${PORT}`);
  console.log(`  • Home: http://localhost:${PORT}`);
  console.log(`  • Reservas: http://localhost:${PORT}/reservas\n`);
});