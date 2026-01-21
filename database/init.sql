USE radio_dedalos;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS price_promotions;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS prices_active;
DROP TABLE IF EXISTS scoreboard_votes;
DROP TABLE IF EXISTS scoreboard_presets;
DROP TABLE IF EXISTS scoreboard_active;
DROP TABLE IF EXISTS historico_promocoes;
DROP TABLE IF EXISTS jukebox_pedidos;
DROP TABLE IF EXISTS agendamentos;
DROP TABLE IF EXISTS radio_config;
DROP TABLE IF EXISTS playlists;
DROP TABLE IF EXISTS tracks;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE tracks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    youtube_id VARCHAR(50) NOT NULL UNIQUE,
    titulo VARCHAR(255) NOT NULL,
    artista VARCHAR(255),
    artistas_participantes JSON,
    album VARCHAR(255),
    ano INT,
    gravadora VARCHAR(255),
    diretor VARCHAR(255),
    thumbnail_url VARCHAR(512) NULL,
    duracao_segundos INT NOT NULL,
    start_segundos INT NOT NULL DEFAULT 0,
    end_segundos INT,
    loudness_lufs DECIMAL(4, 1),
    is_commercial BOOLEAN NOT NULL DEFAULT FALSE,
    dias_semana JSON,
    status_processamento ENUM('PENDENTE', 'PROCESSADO', 'ERRO') NOT NULL DEFAULT 'PENDENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    imagem VARCHAR(255),
    tracks_ids JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_agendamento DATE NOT NULL,
    slot_index INT NOT NULL COMMENT 'Representa o slot de 10min do dia (0-143)',
    playlist_id INT NULL,
    regra_repeticao ENUM('NENHUMA', 'DIA_SEMANA_MES') NOT NULL DEFAULT 'NENHUMA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_data_slot (data_agendamento, slot_index),
    CONSTRAINT fk_playlist FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    CONSTRAINT uq_data_slot UNIQUE (data_agendamento, slot_index)
);

CREATE TABLE jukebox_pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    track_id INT NULL,
    pulseira_id VARCHAR(100) NOT NULL,
    unidade VARCHAR(50) NOT NULL,
    termo_busca VARCHAR(255) NULL,
    status ENUM('PENDENTE', 'TOCADO', 'VETADO', 'SUGERIDA') NOT NULL DEFAULT 'PENDENTE',
    pedido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tocado_em TIMESTAMP NULL,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE radio_config (
    config_key VARCHAR(50) NOT NULL PRIMARY KEY UNIQUE,
    config_value JSON NOT NULL
);

CREATE TABLE historico_promocoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    unidade VARCHAR(10) NOT NULL,
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_sorteados INT,
    total_resgatados INT,
    detalhes JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    data_feriado DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_holiday (unidade, data_feriado)
);

CREATE TABLE prices_active (
    unidade VARCHAR(10) NOT NULL,
    tipo ENUM('padrao', 'fim_de_semana', 'feriado') NOT NULL DEFAULT 'padrao',
    titulo_tabela VARCHAR(255) NOT NULL,
    qtd_categorias INT NOT NULL DEFAULT 3,
    modo_exibicao ENUM('tv', 'tablet') NOT NULL DEFAULT 'tv',
    aviso_1 TEXT,
    aviso_2 TEXT,
    aviso_3 TEXT,
    aviso_4 TEXT,
    categorias JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (unidade, tipo)
);

CREATE TABLE price_promotions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    dias_ativos JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scoreboard_active (
    unidade VARCHAR(10) NOT NULL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    layout ENUM('landscape', 'portrait') NOT NULL DEFAULT 'landscape',
    opcoes JSON NOT NULL,
    status ENUM('ATIVO', 'PAUSADO') NOT NULL DEFAULT 'ATIVO',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE scoreboard_presets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL DEFAULT 'SP',
    titulo_preset VARCHAR(100) NOT NULL,
    titulo_placar VARCHAR(255) NOT NULL,
    layout ENUM('landscape', 'portrait') NOT NULL DEFAULT 'landscape',
    opcoes JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scoreboard_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    option_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO radio_config (config_key, config_value) VALUES ('commercial_track_ids', '[]');
INSERT INTO radio_config (config_key, config_value) VALUES ('fallback_playlist_ids', '{"DOMINGO": 1, "SEGUNDA": 1, "TERCA": 1, "QUARTA": 1, "QUINTA": 1, "SEXTA": 1, "SABADO": 1}');

INSERT INTO scoreboard_active (unidade, titulo, layout, opcoes, status) VALUES 
('SP', 'Aguardando Configuração', 'landscape', '[{"nome":"Opção 1","tipo":"emoji","valor":"⏳"},{"nome":"Opção 2","tipo":"emoji","valor":"🔧"}]', 'PAUSADO'),
('BH', 'Aguardando Configuração', 'landscape', '[{"nome":"Opção 1","tipo":"emoji","valor":"⏳"},{"nome":"Opção 2","tipo":"emoji","valor":"🔧"}]', 'PAUSADO');

INSERT INTO prices_active (unidade, tipo, titulo_tabela, categorias) VALUES 
('SP', 'padrao', 'Tabela Padrão (Seg-Qui)', '[]'),
('SP', 'fim_de_semana', 'Tabela Fim de Semana (Sex-Dom)', '[]'),
('SP', 'feriado', 'Tabela Feriados', '[]'),
('BH', 'padrao', 'Tabela Padrão (Seg-Qui)', '[]'),
('BH', 'fim_de_semana', 'Tabela Fim de Semana (Sex-Dom)', '[]'),
('BH', 'feriado', 'Tabela Feriados', '[]');

-- Tabela para Gestão de Pessoas (Crachás)
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cpf VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    registration_code VARCHAR(50),
    admission_date DATE,
    photo_url TEXT,
    unit VARCHAR(10),
    status ENUM('active', 'archived') DEFAULT 'active',
    is_new BOOLEAN DEFAULT TRUE,
    last_seen_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);