-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: radio_dedalos
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `agendamentos`
--

DROP TABLE IF EXISTS `agendamentos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agendamentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_agendamento` date NOT NULL,
  `slot_index` int NOT NULL COMMENT 'Representa o slot de 10min do dia (0-143)',
  `playlist_id` int DEFAULT NULL,
  `regra_repeticao` enum('NENHUMA','DIA_SEMANA_MES') NOT NULL DEFAULT 'NENHUMA',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_data_slot` (`data_agendamento`,`slot_index`),
  KEY `idx_data_slot` (`data_agendamento`,`slot_index`),
  KEY `fk_playlist` (`playlist_id`),
  CONSTRAINT `fk_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `backup_prices_active`
--

DROP TABLE IF EXISTS `backup_prices_active`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_prices_active` (
  `unidade` varchar(10) NOT NULL,
  `tipo` enum('padrao','fim_de_semana','feriado') NOT NULL DEFAULT 'padrao',
  `titulo_tabela` varchar(255) NOT NULL,
  `qtd_categorias` int NOT NULL DEFAULT '3',
  `modo_exibicao` enum('tv','tablet') NOT NULL DEFAULT 'tv',
  `aviso_1` text,
  `aviso_2` text,
  `aviso_3` text,
  `aviso_4` text,
  `categorias` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`unidade`,`tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `badge_templates`
--

DROP TABLE IF EXISTS `badge_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `badge_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(100) NOT NULL,
  `config` json NOT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cpf` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` varchar(100) DEFAULT NULL,
  `registration_code` varchar(50) DEFAULT NULL,
  `admission_date` date DEFAULT NULL,
  `photo_url` text,
  `unit` varchar(10) DEFAULT NULL,
  `status` enum('active','archived') DEFAULT 'active',
  `is_new` tinyint(1) DEFAULT '1',
  `last_seen_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf` (`cpf`)
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `golden_card_config`
--

DROP TABLE IF EXISTS `golden_card_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `golden_card_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade` varchar(10) NOT NULL,
  `card_index` int NOT NULL,
  `prize_type` varchar(100) DEFAULT NULL,
  `prize_details` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_card_unit` (`unidade`,`card_index`)
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `historico_promocoes`
--

DROP TABLE IF EXISTS `historico_promocoes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historico_promocoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo` varchar(50) NOT NULL,
  `unidade` varchar(10) NOT NULL,
  `data_hora` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `total_sorteados` int DEFAULT NULL,
  `total_resgatados` int DEFAULT NULL,
  `detalhes` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=179 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `holidays`
--

DROP TABLE IF EXISTS `holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade` varchar(10) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `data_feriado` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_holiday` (`unidade`,`data_feriado`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jukebox_pedidos`
--

DROP TABLE IF EXISTS `jukebox_pedidos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jukebox_pedidos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `track_id` int DEFAULT NULL,
  `pulseira_id` varchar(100) NOT NULL,
  `unidade` varchar(50) NOT NULL,
  `termo_busca` varchar(255) DEFAULT NULL,
  `status` enum('PENDENTE','TOCADO','VETADO','SUGERIDA') NOT NULL DEFAULT 'PENDENTE',
  `pedido_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tocado_em` timestamp NULL DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `track_id` (`track_id`),
  CONSTRAINT `jukebox_pedidos_ibfk_1` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1929 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `playlists`
--

DROP TABLE IF EXISTS `playlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `descricao` text,
  `imagem` varchar(255) DEFAULT NULL,
  `overlay` varchar(255) DEFAULT NULL,
  `tracks_ids` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `price_category_media`
--

DROP TABLE IF EXISTS `price_category_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_category_media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade` varchar(10) NOT NULL,
  `qtd_pessoas` int NOT NULL,
  `titulo` varchar(50) DEFAULT NULL,
  `media_url` varchar(512) DEFAULT NULL,
  `aviso_categoria` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_cat_media` (`unidade`,`qtd_pessoas`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `price_defaults`
--

DROP TABLE IF EXISTS `price_defaults`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_defaults` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_dia` enum('semana','fim_de_semana') NOT NULL,
  `periodo` enum('manha','tarde','noite') NOT NULL,
  `qtd_pessoas` int NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `horario_inicio` time NOT NULL,
  `horario_fim` time NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `unidade` varchar(10) NOT NULL DEFAULT 'SP',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_price_rule_unit` (`unidade`,`tipo_dia`,`periodo`,`qtd_pessoas`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `price_live_state`
--

DROP TABLE IF EXISTS `price_live_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_live_state` (
  `unidade` varchar(10) NOT NULL,
  `modo_festa` tinyint(1) DEFAULT '0',
  `party_banners` json DEFAULT NULL,
  `valor_passado` decimal(10,2) DEFAULT NULL,
  `valor_atual` decimal(10,2) DEFAULT NULL,
  `valor_futuro` decimal(10,2) DEFAULT NULL,
  `texto_futuro` varchar(50) DEFAULT '???',
  `aviso_1` text,
  `aviso_2` text,
  `aviso_3` text,
  `aviso_4` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`unidade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `price_promotions`
--

DROP TABLE IF EXISTS `price_promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_promotions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade` varchar(10) NOT NULL,
  `image_url` varchar(512) NOT NULL,
  `dias_ativos` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=273 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `radio_config`
--

DROP TABLE IF EXISTS `radio_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radio_config` (
  `config_key` varchar(50) NOT NULL,
  `config_value` json NOT NULL,
  PRIMARY KEY (`config_key`),
  UNIQUE KEY `config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scoreboard_active`
--

DROP TABLE IF EXISTS `scoreboard_active`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scoreboard_active` (
  `unidade` varchar(10) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `layout` enum('landscape','portrait') NOT NULL DEFAULT 'landscape',
  `opcoes` json NOT NULL,
  `status` enum('ATIVO','PAUSADO') NOT NULL DEFAULT 'ATIVO',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`unidade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scoreboard_presets`
--

DROP TABLE IF EXISTS `scoreboard_presets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scoreboard_presets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade` varchar(10) NOT NULL DEFAULT 'SP',
  `titulo_preset` varchar(100) NOT NULL,
  `titulo_placar` varchar(255) NOT NULL,
  `layout` enum('landscape','portrait') NOT NULL DEFAULT 'landscape',
  `opcoes` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scoreboard_votes`
--

DROP TABLE IF EXISTS `scoreboard_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scoreboard_votes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade` varchar(10) NOT NULL,
  `cliente_id` varchar(50) DEFAULT NULL,
  `option_index` int DEFAULT NULL,
  `status` enum('DENTRO','SAIU') NOT NULL DEFAULT 'DENTRO',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `cliente_nome` varchar(255) DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cliente_pulseira` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_votes_created_at` (`created_at`),
  KEY `idx_status_cliente` (`status`,`cliente_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8761 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tracks`
--

DROP TABLE IF EXISTS `tracks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tracks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `youtube_id` varchar(50) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `artista` varchar(255) DEFAULT NULL,
  `artistas_participantes` json DEFAULT NULL,
  `album` varchar(255) DEFAULT NULL,
  `ano` int DEFAULT NULL,
  `gravadora` varchar(255) DEFAULT NULL,
  `diretor` varchar(255) DEFAULT NULL,
  `thumbnail_url` varchar(512) DEFAULT NULL,
  `duracao_segundos` int NOT NULL,
  `start_segundos` int NOT NULL DEFAULT '0',
  `end_segundos` int DEFAULT NULL,
  `loudness_lufs` decimal(4,1) DEFAULT NULL,
  `is_commercial` tinyint(1) NOT NULL DEFAULT '0',
  `dias_semana` json DEFAULT NULL,
  `status_processamento` enum('PENDENTE','PROCESSADO','ERRO') NOT NULL DEFAULT 'PENDENTE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `youtube_id` (`youtube_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1354 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-23 21:44:43
