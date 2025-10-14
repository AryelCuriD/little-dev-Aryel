CREATE DATABASE IF NOT EXISTS `projeto_little_dev`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `projeto_little_dev`;

-- ============================
-- TABELA SALAS
-- ============================
CREATE TABLE IF NOT EXISTS `salas` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_sala VARCHAR(3) NOT NULL,
  tipo_sala VARCHAR(50) NOT NULL,
  localizacao VARCHAR(50) NOT NULL,
  capacidade ENUM('0-20','20-40','40+') NOT NULL,
  imagem LONGBLOB,
  tipo_mime VARCHAR(50),
  descricao TEXT,
  projetor BOOLEAN DEFAULT FALSE,
  ar_condicionado BOOLEAN DEFAULT FALSE,
  apagador BOOLEAN DEFAULT FALSE,
  canetoes BOOLEAN DEFAULT FALSE,
  televisao BOOLEAN DEFAULT FALSE,
  computador BOOLEAN DEFAULT FALSE
);

-- ============================
-- TABELA RESERVAS
-- ============================
CREATE TABLE IF NOT EXISTS `reservas` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitante VARCHAR(50) NOT NULL,
  data_inicio DATETIME NOT NULL,
  data_fim DATETIME NOT NULL,
  sala_id INT NOT NULL,
  status ENUM('ativa', 'encerrada') DEFAULT 'ativa',
  FOREIGN KEY (sala_id) REFERENCES salas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ============================
-- TABELA DEVOLUÇÃO DE ESTOJO
-- ============================
CREATE TABLE IF NOT EXISTS `devolucao_estojo` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id INT NOT NULL,
  estojo_completo VARCHAR(100) DEFAULT 'TRUE',
  observacao TEXT,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ============================
-- INSERÇÃO DE DADOS
-- ============================

INSERT INTO salas 
(numero_sala, tipo_sala, localizacao, capacidade, descricao, projetor, ar_condicionado, apagador, canetoes, televisao, computador)
VALUES
('101', 'Sala de Aula', 'Bloco 1 - 1º Piso', '0-20', 'Sala de aula padrão com projetor e ar-condicionado.', TRUE, TRUE, TRUE, TRUE, FALSE, FALSE),
('102', 'Laboratório de TI', 'Bloco 1 - 1º Piso', '20-40', 'Laboratório de informática equipado com 20 computadores.', FALSE, TRUE, TRUE, TRUE, TRUE, TRUE),
('201', 'Laboratório de Química', 'Bloco 2 - 2º Piso', '20-40', 'Laboratório com bancadas e equipamentos de química.', TRUE, TRUE, TRUE, TRUE, FALSE, FALSE),
('301', 'Sala de Aula', 'Bloco 3 - 2º Piso', '40+', 'Sala ampla para turmas grandes, equipada com televisão e ar-condicionado.', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE),
('310', 'Laboratório de Eletrônica', 'Bloco 3 - 2º Piso', '0-20', 'Laboratório de eletrônica com bancadas e instrumentos de medição.', TRUE, TRUE, TRUE, TRUE, FALSE, TRUE);

INSERT INTO reservas 
(solicitante, data_inicio, data_fim, sala_id, status)
VALUES
('Prof. Berti', '2024-11-25 08:00:00', '2024-11-25 10:00:00', 1, 'ativa'),
('Prof. Julia', '2024-11-25 10:00:00', '2024-11-25 12:00:00', 2, 'ativa'),
('Prof. Lucas', '2024-11-26 13:00:00', '2024-11-26 15:00:00', 3, 'encerrada'),
('Prof. Maria', '2024-11-27 07:00:00', '2024-11-27 09:00:00', 4, 'encerrada'),
('Prof. Ana', '2024-11-28 09:00:00', '2024-11-28 11:00:00', 5, 'ativa');

INSERT INTO devolucao_estojo 
(reserva_id, estojo_completo, observacao)
VALUES
(1, 'TRUE', 'Estojo devolvido completo.'),
(2, 'FALSE', 'Faltando controle do ar-condicionado.'),
(3, 'TRUE', 'Estojo devolvido completo.'),
(4, 'FALSE', 'Faltando apagador.'),
(5, 'TRUE', 'Estojo devolvido completo.');
