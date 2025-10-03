const express = require('express');
const path = require('path');
const util = require('util');
const connection = require('./models/db');
const query = util.promisify(connection.query).bind(connection);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// =============================
// ROTAS API - SALAS
// =============================
app.get('/salas', async (req, res) => {
  try {
    const results = await query('SELECT * FROM salas');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/salas', async (req, res) => {
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

// =============================
// ROTAS API - RESERVAS
// =============================
app.get('/reservas', async (req, res) => {
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

app.post('/reservas', async (req, res) => {
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

// =============================
// ROTAS API - DEVOLUÇÃO ESTOJO
// =============================
app.get('/devolucao', async (req, res) => {
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

app.post('/devolucao', async (req, res) => {
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

// =============================
app.listen(8080, () => {
  console.log(`Servidor rodando em http://localhost:8080`);
});
