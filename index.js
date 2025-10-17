const express = require('express');
const path = require('path');
const util = require('util');
const connection = require('./models/db');
const query = util.promisify(connection.query).bind(connection);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src')));

// Rotas das páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.get('/reservas', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'reservas.html'));
});

app.get('/relatorios', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'relatorios.html'));
});

app.get('/usuario', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'usuario.html'));
});

// Rotas API - Salas
app.get('/api/salas', async (req, res) => {
  try {
    const results = await query('SELECT * FROM salas');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    // Conta salas comuns e laboratórios separadamente
    const [salasResult] = await connection.query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Sala%'");
    const [labsResult] = await connection.query("SELECT COUNT(*) AS total FROM salas WHERE tipo_sala LIKE 'Laboratório%'");

    // Conta reservas ativas
    const [reservasAtivasResult] = await connection.query("SELECT COUNT(*) AS total FROM reservas WHERE status = 'ativa'");

    // Conta devoluções pendentes
    const [devolucoesResult] = await connection.query("SELECT COUNT(*) AS total FROM devolucao_estojo WHERE estojo_completo = 'FALSE'");

    res.json({
      salasDisponiveis: salasResult.total,
      labsDisponiveis: labsResult.total,
      reservasAtivas: reservasAtivasResult.total,
      devolucoesPendentes: devolucoesResult.total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas do dashboard' });
  }
});


app.post('/api/salas', async (req, res) => {
  const { numero_sala, tipo_sala, localizacao, capacidade, descricao } = req.body;
  try {
    const results = await query(
      'INSERT INTO salas (numero_sala, tipo_sala, localizacao, capacidade, descricao) VALUES (?, ?, ?, ?, ?)',
      [numero_sala, tipo_sala, localizacao, capacidade, descricao]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas API - Reservas
app.get('/api/reservas', async (req, res) => {
  try {
    const results = await query(
      `SELECT r.id, r.solicitante, r.data_inicio, r.data_fim,
              s.numero_sala, s.localizacao, s.tipo_sala
       FROM reservas r
       JOIN salas s ON r.sala_id = s.id`
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reservas', async (req, res) => {
  const { solicitante, data_inicio, data_fim, sala_id } = req.body;
  try {
    const results = await query(
      'INSERT INTO reservas (solicitante, data_inicio, data_fim, sala_id) VALUES (?, ?, ?, ?)',
      [solicitante, data_inicio, data_fim, sala_id]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas API - Devolução Estojo
app.get('/api/devolucao', async (req, res) => {
  try {
    const results = await query(
      `SELECT d.id, d.estojo_completo, d.observacao,
              r.solicitante, r.data_inicio, r.data_fim, s.numero_sala
       FROM devolucao_estojo d
       JOIN reservas r ON d.reserva_id = r.id
       JOIN salas s ON r.sala_id = s.id`
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/devolucao', async (req, res) => {
  const { reserva_id, estojo_completo, observacao } = req.body;
  try {
    const results = await query(
      'INSERT INTO devolucao_estojo (reserva_id, estojo_completo, observacao) VALUES (?, ?, ?)',
      [reserva_id, estojo_completo, observacao]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(8080, () => {
  console.log(`Servidor rodando em http://localhost:8080`);
});