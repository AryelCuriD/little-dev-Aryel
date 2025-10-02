CREATE DATABASE IF NOT EXISTS `projeto_little_dev`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `projeto_little_dev`;

CREATE TABLE IF NOT EXISTS `salas` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_sala VARCHAR(3) NOT NULL,
  tipo_sala VARCHAR(50) NOT NULL, -- ex: 'AULA', 'TI', 'QUIM'
  localizacao VARCHAR(50) NOT NULL, -- ex: 'Bloco A - 2º andar'
  capacidade ENUM('0-20','20-40','40+') NOT NULL,
  imagem LONGBLOB,
  tipo_mime VARCHAR(50),-- armazenar foto da sala
  descricao TEXT,
  projetor BOOLEAN DEFAULT FALSE,
  ar_condicionado BOOLEAN DEFAULT FALSE,
  apagador BOOLEAN DEFAULT FALSE,
  canetoes BOOLEAN DEFAULT FALSE,
  televisao BOOLEAN DEFAULT FALSE,
  computador BOOLEAN DEFAULT FALSE
);


CREATE TABLE IF NOT EXISTS `reservas` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitante VARCHAR(50) NOT NULL,
  data_inicio DATETIME NOT NULL, -- início da reserva
  data_fim DATETIME NOT NULL, -- término da reserva
  sala_id INT NOT NULL,
  FOREIGN KEY (sala_id) REFERENCES salas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);


CREATE TABLE IF NOT EXISTS `devolucao_estojo` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id INT NOT NULL,
  estojo_completo VARCHAR(100) DEFAULT TRUE,
  observacao TEXT,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);