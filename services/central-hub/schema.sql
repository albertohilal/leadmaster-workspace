-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: sv46.byethost46.org    Database: iunaorg_dyd
-- ------------------------------------------------------
-- Server version	5.5.5-10.11.15-MariaDB-cll-lve-log

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
-- Table structure for table `ll_bot_respuestas`
--

DROP TABLE IF EXISTS `ll_bot_respuestas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_bot_respuestas` (
  `cliente_id` int(11) NOT NULL,
  `responder_activo` tinyint(1) NOT NULL DEFAULT 1,
  `actualizado_en` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `actualizado_por` varchar(120) DEFAULT NULL,
  PRIMARY KEY (`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_busquedas`
--

DROP TABLE IF EXISTS `ll_busquedas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_busquedas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `celda_id` varchar(50) DEFAULT NULL,
  `keyword_google` varchar(255) DEFAULT NULL,
  `fecha` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_busquedas_realizadas`
--

DROP TABLE IF EXISTS `ll_busquedas_realizadas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_busquedas_realizadas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grilla_id` int(11) NOT NULL,
  `keyword` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `grilla_id` (`grilla_id`),
  CONSTRAINT `ll_busquedas_realizadas_ibfk_1` FOREIGN KEY (`grilla_id`) REFERENCES `ll_grilla` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1047 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_campanias_whatsapp`
--

DROP TABLE IF EXISTS `ll_campanias_whatsapp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_campanias_whatsapp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `mensaje` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `estado` enum('pendiente','en_progreso','finalizado') DEFAULT 'pendiente',
  `cliente_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9007 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_cliente_google_tokens`
--

DROP TABLE IF EXISTS `ll_cliente_google_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_cliente_google_tokens` (
  `cliente_id` int(11) NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token` text NOT NULL,
  `token_type` varchar(50) DEFAULT 'Bearer',
  `expiry_date` bigint(20) DEFAULT NULL COMMENT 'Timestamp en milisegundos',
  `scope` text DEFAULT NULL COMMENT 'Permisos autorizados',
  `fecha_autorizacion` datetime DEFAULT current_timestamp(),
  `ultima_actualizacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `activo` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`cliente_id`),
  CONSTRAINT `ll_cliente_google_tokens_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `ll_usuarios` (`cliente_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tokens OAuth2 de Google para cada cliente';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_envios_manual`
--

DROP TABLE IF EXISTS `ll_envios_manual`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_envios_manual` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `prospecto_id` bigint(20) unsigned NOT NULL,
  `telefono` varchar(50) NOT NULL,
  `mensaje` text DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_prospecto_id` (`prospecto_id`),
  KEY `idx_fecha` (`fecha`),
  KEY `idx_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_envios_whatsapp`
--

DROP TABLE IF EXISTS `ll_envios_whatsapp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_envios_whatsapp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campania_id` int(11) NOT NULL,
  `telefono_wapp` varchar(255) DEFAULT NULL,
  `nombre_destino` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mensaje_final` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` enum('pendiente','enviado','error') DEFAULT 'pendiente',
  `fecha_envio` datetime DEFAULT NULL,
  `lugar_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_unico_envio` (`campania_id`,`telefono_wapp`),
  KEY `idx_envios_lugar_camp_estado` (`lugar_id`,`campania_id`,`estado`),
  KEY `idx_envios_camp_estado` (`campania_id`,`estado`),
  CONSTRAINT `ll_envios_whatsapp_ibfk_1` FOREIGN KEY (`campania_id`) REFERENCES `ll_campanias_whatsapp` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5191 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_envios_whatsapp_46`
--

DROP TABLE IF EXISTS `ll_envios_whatsapp_46`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_envios_whatsapp_46` (
  `id` int(11) NOT NULL DEFAULT 0,
  `campania_id` int(11) NOT NULL,
  `telefono_wapp` varchar(255) DEFAULT NULL,
  `nombre_destino` varchar(255) DEFAULT NULL,
  `mensaje_final` text DEFAULT NULL,
  `estado` enum('pendiente','enviado','error') DEFAULT 'pendiente',
  `fecha_envio` datetime DEFAULT NULL,
  `lugar_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_envios_whatsapp_historial`
--

DROP TABLE IF EXISTS `ll_envios_whatsapp_historial`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_envios_whatsapp_historial` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `envio_id` int(11) NOT NULL,
  `estado_anterior` enum('no_incluido','pendiente','enviado','error') NOT NULL,
  `estado_nuevo` enum('no_incluido','pendiente','enviado','error') NOT NULL,
  `origen` varchar(50) NOT NULL,
  `detalle` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_envio_id` (`envio_id`),
  CONSTRAINT `fk_envio_historial` FOREIGN KEY (`envio_id`) REFERENCES `ll_envios_whatsapp` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_fuentes`
--

DROP TABLE IF EXISTS `ll_fuentes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_fuentes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_grilla`
--

DROP TABLE IF EXISTS `ll_grilla`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_grilla` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grilla_nombre` varchar(100) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `fila` int(11) NOT NULL,
  `columna` int(11) NOT NULL,
  `lat1` decimal(10,6) NOT NULL,
  `lng1` decimal(10,6) NOT NULL,
  `lat2` decimal(10,6) NOT NULL,
  `lng2` decimal(10,6) NOT NULL,
  `lat_centro` decimal(10,6) NOT NULL,
  `lng_centro` decimal(10,6) NOT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'pendiente',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1601 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_grilla_rubros`
--

DROP TABLE IF EXISTS `ll_grilla_rubros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_grilla_rubros` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grilla_id` int(11) NOT NULL,
  `rubro_id` int(11) NOT NULL,
  `estado` enum('pendiente','seleccionado','revisar','descartado') DEFAULT 'pendiente',
  `fecha_modificacion` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `grilla_rubro_unico` (`grilla_id`,`rubro_id`),
  KEY `idx_grilla` (`grilla_id`),
  KEY `idx_rubro` (`rubro_id`),
  KEY `idx_estado` (`estado`),
  CONSTRAINT `ll_grilla_rubros_ibfk_1` FOREIGN KEY (`grilla_id`) REFERENCES `ll_grilla` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ll_grilla_rubros_ibfk_2` FOREIGN KEY (`rubro_id`) REFERENCES `ll_rubros` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2518 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_grillas`
--

DROP TABLE IF EXISTS `ll_grillas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_grillas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `zona` varchar(100) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_haby_leads`
--

DROP TABLE IF EXISTS `ll_haby_leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_haby_leads` (
  `rowid` int(11) NOT NULL DEFAULT 0,
  `nom` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `usuario` varchar(100),
  `phone_mobile` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `client` tinyint(4) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_ia_control`
--

DROP TABLE IF EXISTS `ll_ia_control`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_ia_control` (
  `telefono` varchar(32) NOT NULL,
  `ia_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_ia_conversaciones`
--

DROP TABLE IF EXISTS `ll_ia_conversaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_ia_conversaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) DEFAULT 51,
  `telefono` varchar(20) NOT NULL,
  `rol` enum('user','assistant') NOT NULL,
  `origen_mensaje` enum('ia','humano','sistema') DEFAULT 'ia',
  `pauso_ia` tinyint(1) DEFAULT 0,
  `mensaje` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cliente_telefono` (`cliente_id`,`telefono`)
) ENGINE=InnoDB AUTO_INCREMENT=199 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_intervenciones_humanas`
--

DROP TABLE IF EXISTS `ll_intervenciones_humanas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_intervenciones_humanas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `telefono` varchar(32) NOT NULL,
  `mensaje_humano` text DEFAULT NULL,
  `fecha_intervencion` timestamp NULL DEFAULT current_timestamp(),
  `conversacion_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_telefono` (`telefono`),
  KEY `idx_fecha` (`fecha_intervencion`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares`
--

DROP TABLE IF EXISTS `ll_lugares`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `place_id` varchar(255) NOT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `rubro` varchar(100) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `telefono` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `sitio_web` varchar(255) DEFAULT NULL,
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `rubro_id` int(11) DEFAULT NULL,
  `zona_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `rating` decimal(2,1) DEFAULT NULL,
  `reviews` int(11) DEFAULT 0,
  `tipos` text DEFAULT NULL,
  `precio` tinyint(4) DEFAULT NULL,
  `abierto` tinyint(1) DEFAULT NULL,
  `ref_ext` varchar(64) DEFAULT NULL,
  `telefono_wapp` varchar(20) DEFAULT NULL,
  `wapp_valido` tinyint(1) DEFAULT NULL,
  `origen` varchar(50) DEFAULT 'google_places',
  PRIMARY KEY (`id`),
  UNIQUE KEY `place_id` (`place_id`),
  KEY `rubro_id` (`rubro_id`),
  CONSTRAINT `ll_lugares_ibfk_1` FOREIGN KEY (`rubro_id`) REFERENCES `ll_rubros` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8449 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares_clientes`
--

DROP TABLE IF EXISTS `ll_lugares_clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares_clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `societe_id` int(11) NOT NULL,
  `ref_ext` varchar(64) NOT NULL,
  `cliente_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_societe` (`societe_id`),
  KEY `idx_ref_ext` (`ref_ext`),
  KEY `idx_cliente` (`cliente_id`),
  KEY `idx_lc_cliente_societe` (`cliente_id`,`societe_id`),
  KEY `idx_lc_societe` (`societe_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2307 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares_clientes_backup_20251210`
--

DROP TABLE IF EXISTS `ll_lugares_clientes_backup_20251210`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares_clientes_backup_20251210` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lugar_id` int(11) NOT NULL,
  `haby_id` int(11) DEFAULT NULL,
  `cliente_id` int(11) NOT NULL,
  `societe_id` int(11) DEFAULT NULL,
  `ref_ext` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1802 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares_haby`
--

DROP TABLE IF EXISTS `ll_lugares_haby`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares_haby` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `First Name` varchar(46) DEFAULT NULL,
  `Middle Name` varchar(21) DEFAULT NULL,
  `Last Name` varchar(22) DEFAULT NULL,
  `Organization Name` varchar(18) DEFAULT NULL,
  `Phone 1 - Value` varchar(255) DEFAULT NULL,
  `telefono_wapp` varchar(20) DEFAULT NULL,
  `nombre` text DEFAULT NULL,
  `ref_ext` varchar(64) DEFAULT NULL,
  `rubro_id` int(11) DEFAULT NULL COMMENT 'FK a ll_rubros.id',
  PRIMARY KEY (`id`),
  KEY `idx_rubro_id` (`rubro_id`)
) ENGINE=InnoDB AUTO_INCREMENT=258 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares_scrap`
--

DROP TABLE IF EXISTS `ll_lugares_scrap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares_scrap` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `place_id` varchar(255) NOT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `tipo_dato` enum('telefono','sitio_web','instagram','facebook','whatsapp','email','otro') NOT NULL,
  `valor` text NOT NULL,
  `fuente` enum('manual','scraper','ia','api_externa') DEFAULT 'manual',
  `fecha_scrap` datetime DEFAULT current_timestamp(),
  `observaciones` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `place_id` (`place_id`),
  KEY `tipo_dato` (`tipo_dato`),
  KEY `fuente` (`fuente`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_mensajes`
--

DROP TABLE IF EXISTS `ll_mensajes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_mensajes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `telefono` varchar(20) DEFAULT NULL,
  `mensaje` text DEFAULT NULL,
  `respuesta` text DEFAULT NULL,
  `fecha` datetime DEFAULT current_timestamp(),
  `fuente` enum('whatsapp','email','web') DEFAULT NULL,
  `lugar_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_lugar` (`lugar_id`),
  CONSTRAINT `fk_lugar` FOREIGN KEY (`lugar_id`) REFERENCES `ll_lugares` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_programacion_envios_diarios`
--

DROP TABLE IF EXISTS `ll_programacion_envios_diarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_programacion_envios_diarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `programacion_id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `enviados` int(11) NOT NULL DEFAULT 0,
  `actualizado_en` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_programacion_fecha` (`programacion_id`,`fecha`),
  CONSTRAINT `fk_prog_envios_programacion` FOREIGN KEY (`programacion_id`) REFERENCES `ll_programaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_programaciones`
--

DROP TABLE IF EXISTS `ll_programaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_programaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campania_id` int(11) NOT NULL,
  `cliente_id` int(11) NOT NULL,
  `dias_semana` varchar(64) NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `cupo_diario` int(11) NOT NULL DEFAULT 50,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `estado` enum('pendiente','aprobada','rechazada','pausada') NOT NULL DEFAULT 'pendiente',
  `comentario_cliente` text DEFAULT NULL,
  `comentario_admin` text DEFAULT NULL,
  `creado_por` varchar(120) DEFAULT NULL,
  `aprobado_por` varchar(120) DEFAULT NULL,
  `sesion_cliente` varchar(120) DEFAULT NULL,
  `aprobado_en` datetime DEFAULT NULL,
  `rechazo_motivo` text DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `locked_at` datetime DEFAULT NULL COMMENT 'Timestamp de lock para procesamiento concurrente',
  `locked_by` varchar(64) DEFAULT NULL COMMENT 'Identificador del proceso que tiene el lock',
  PRIMARY KEY (`id`),
  KEY `idx_programaciones_campania` (`campania_id`),
  KEY `idx_programaciones_cliente` (`cliente_id`),
  KEY `idx_programaciones_estado` (`estado`),
  KEY `idx_locked_at` (`locked_at`,`estado`),
  CONSTRAINT `fk_programaciones_campania` FOREIGN KEY (`campania_id`) REFERENCES `ll_campanias_whatsapp` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9007 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_reactivaciones_ia`
--

DROP TABLE IF EXISTS `ll_reactivaciones_ia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_reactivaciones_ia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `telefono` varchar(32) NOT NULL,
  `motivo` varchar(100) DEFAULT 'reactivacion_manual',
  `fecha_reactivacion` timestamp NULL DEFAULT current_timestamp(),
  `usuario_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_rubros`
--

DROP TABLE IF EXISTS `ll_rubros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_rubros` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `area` varchar(100) DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `nombre_es` varchar(100) DEFAULT NULL,
  `keyword_google` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `busqueda` tinyint(1) DEFAULT 0,
  `fuente_id` int(11) DEFAULT 2,
  PRIMARY KEY (`id`),
  KEY `fk_rubros_fuente` (`fuente_id`),
  KEY `idx_keyword_google_b89457` (`keyword_google`),
  KEY `idx_rubros_area` (`area`),
  KEY `idx_rubros_nombre_es` (`nombre_es`),
  CONSTRAINT `fk_rubros_fuente` FOREIGN KEY (`fuente_id`) REFERENCES `ll_fuentes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=302 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_societe_extended`
--

DROP TABLE IF EXISTS `ll_societe_extended`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_societe_extended` (
  `societe_id` int(11) NOT NULL COMMENT 'FK a llxbx_societe.rowid',
  `rubro_id` int(11) DEFAULT NULL COMMENT 'FK a ll_rubros.id',
  `origen` varchar(50) DEFAULT NULL COMMENT 'Fuente: google_places, haby, manual',
  `instagram_url` varchar(500) DEFAULT NULL,
  `facebook_url` varchar(500) DEFAULT NULL,
  `linkedin_url` varchar(500) DEFAULT NULL,
  `tiktok_url` varchar(500) DEFAULT NULL,
  `twitter_url` varchar(500) DEFAULT NULL,
  `rating` decimal(2,1) DEFAULT NULL,
  `reviews` int(11) DEFAULT NULL,
  `tipos` varchar(1000) DEFAULT NULL,
  `precio` varchar(50) DEFAULT NULL,
  `abierto` varchar(255) DEFAULT NULL,
  `place_id` varchar(255) DEFAULT NULL,
  `wapp_valido` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`societe_id`),
  KEY `idx_rubro` (`rubro_id`),
  KEY `idx_origen` (`origen`),
  KEY `idx_se_societe` (`societe_id`),
  KEY `idx_se_rubro` (`rubro_id`),
  KEY `idx_instagram` (`instagram_url`(255)),
  KEY `idx_facebook` (`facebook_url`(255)),
  KEY `idx_linkedin` (`linkedin_url`(255)),
  KEY `idx_place_id` (`place_id`),
  CONSTRAINT `ll_societe_extended_ibfk_1` FOREIGN KEY (`societe_id`) REFERENCES `llxbx_societe` (`rowid`) ON DELETE CASCADE,
  CONSTRAINT `ll_societe_extended_ibfk_2` FOREIGN KEY (`rubro_id`) REFERENCES `ll_rubros` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Extensión custom de llxbx_societe - inmune a upgrades de Dolibarr';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_sync_contactos_config`
--

DROP TABLE IF EXISTS `ll_sync_contactos_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_sync_contactos_config` (
  `cliente_id` int(11) NOT NULL,
  `sync_automatico` tinyint(1) DEFAULT 1 COMMENT '1=activado, 0=manual solamente',
  `frecuencia_horas` int(11) DEFAULT 6 COMMENT 'Cada cuántas horas sincronizar',
  `solo_con_whatsapp` tinyint(1) DEFAULT 1 COMMENT 'Solo sincronizar si tiene phone_mobile',
  `incluir_clientes` tinyint(1) DEFAULT 1 COMMENT 'Incluir registros con client=1',
  `incluir_prospectos` tinyint(1) DEFAULT 1 COMMENT 'Incluir registros con client=0',
  `prefijo_nombre` varchar(100) DEFAULT '' COMMENT 'Prefijo para todos los contactos ej: [Haby]',
  `sufijo_nombre` varchar(100) DEFAULT '' COMMENT 'Sufijo para todos los contactos',
  `ultima_sync_completa` datetime DEFAULT NULL,
  `proxima_sync_programada` datetime DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`cliente_id`),
  CONSTRAINT `ll_sync_contactos_config_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `ll_usuarios` (`cliente_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuración de sincronización por cliente';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_sync_contactos_log`
--

DROP TABLE IF EXISTS `ll_sync_contactos_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_sync_contactos_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) NOT NULL,
  `accion` varchar(50) NOT NULL COMMENT 'create, update, delete, sync_full',
  `societe_id` int(11) DEFAULT NULL,
  `google_resource_name` varchar(255) DEFAULT NULL COMMENT 'ID del contacto en Google',
  `nombre_contacto` varchar(255) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `fecha_sync` datetime DEFAULT current_timestamp(),
  `estado` varchar(50) NOT NULL COMMENT 'success, error, skipped',
  `mensaje` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cliente` (`cliente_id`),
  KEY `idx_societe` (`societe_id`),
  KEY `idx_fecha` (`fecha_sync`),
  KEY `idx_estado` (`estado`),
  CONSTRAINT `ll_sync_contactos_log_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `ll_usuarios` (`cliente_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log de sincronizaciones de contactos con Gmail';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_sync_contactos_mapping`
--

DROP TABLE IF EXISTS `ll_sync_contactos_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_sync_contactos_mapping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) NOT NULL,
  `societe_id` int(11) NOT NULL,
  `google_resource_name` varchar(255) NOT NULL COMMENT 'people/c1234567890',
  `google_etag` varchar(100) DEFAULT NULL COMMENT 'Para detectar cambios en Google',
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mapping` (`cliente_id`,`societe_id`),
  UNIQUE KEY `unique_google` (`cliente_id`,`google_resource_name`),
  KEY `idx_societe` (`societe_id`),
  KEY `idx_google` (`google_resource_name`),
  CONSTRAINT `ll_sync_contactos_mapping_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `ll_usuarios` (`cliente_id`) ON DELETE CASCADE,
  CONSTRAINT `ll_sync_contactos_mapping_ibfk_2` FOREIGN KEY (`societe_id`) REFERENCES `llxbx_societe` (`rowid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mapeo entre contactos Dolibarr y Google Contacts';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_temp_telefonos`
--

DROP TABLE IF EXISTS `ll_temp_telefonos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_temp_telefonos` (
  `place_id` text DEFAULT NULL,
  `telefono_wapp` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_usuarios`
--

DROP TABLE IF EXISTS `ll_usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) DEFAULT NULL,
  `usuario` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `tipo` enum('cliente','admin') DEFAULT 'cliente',
  `activo` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario` (`usuario`),
  KEY `cliente_id` (`cliente_id`),
  CONSTRAINT `ll_usuarios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `llxbx_societe` (`rowid`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_usuarios_wa`
--

DROP TABLE IF EXISTS `ll_usuarios_wa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_usuarios_wa` (
  `telefono` varchar(20) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `rubro_id` int(11) DEFAULT NULL,
  `ultima_interaccion` datetime DEFAULT NULL,
  `fuente` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`telefono`),
  KEY `fk_rubro` (`rubro_id`),
  CONSTRAINT `fk_rubro` FOREIGN KEY (`rubro_id`) REFERENCES `ll_rubros` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_whatsapp_qr_authorizations`
--

DROP TABLE IF EXISTS `ll_whatsapp_qr_authorizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_whatsapp_qr_authorizations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) unsigned NOT NULL,
  `authorized_by` bigint(20) unsigned NOT NULL COMMENT 'ID del usuario/admin que autoriza',
  `valid_from` datetime NOT NULL,
  `valid_until` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_qr_cliente` (`cliente_id`),
  KEY `idx_qr_vigencia` (`valid_from`,`valid_until`),
  KEY `idx_qr_revocado` (`revoked_at`),
  CONSTRAINT `chk_qr_valid_window` CHECK (`valid_until` > `valid_from`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ventanas de autorización temporal para QR de WhatsApp';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_whatsapp_qr_sessions`
--

DROP TABLE IF EXISTS `ll_whatsapp_qr_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_whatsapp_qr_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID Ãºnico de la sesiÃ³n de autorizaciÃ³n',
  `cliente_id` bigint(20) unsigned NOT NULL COMMENT 'ID del cliente que tiene permiso para escanear QR',
  `enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'TRUE = autorizaciÃ³n activa, FALSE = expirada o revocada',
  `enabled_by_admin_id` bigint(20) unsigned NOT NULL COMMENT 'ID del administrador que autorizÃ³ el acceso',
  `enabled_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Timestamp UTC de cuando se creÃ³ la autorizaciÃ³n',
  `expires_at` datetime NOT NULL COMMENT 'Timestamp UTC de expiraciÃ³n',
  `revoked_at` datetime DEFAULT NULL COMMENT 'Timestamp UTC de revocaciÃ³n manual',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Timestamp de creaciÃ³n del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cliente_enabled` (`cliente_id`,`enabled`),
  KEY `idx_cliente_id` (`cliente_id`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_enabled` (`enabled`),
  KEY `idx_enabled_by_admin` (`enabled_by_admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Control de autorizaciÃ³n temporal para escaneo de QR WhatsApp';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_zonas`
--

DROP TABLE IF EXISTS `ll_zonas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_zonas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `latitud` decimal(10,7) NOT NULL,
  `longitud` decimal(10,7) NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `busqueda` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `llxbx_accounting_account`
--

DROP TABLE IF EXISTS `llxbx_accounting_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `llxbx_accounting_account` (
  `rowid` bigint(20) NOT NULL AUTO_INCREMENT,
  `entity` int(11) NOT NULL DEFAULT 1,
  `datec` datetime DEFAULT NULL,
  `tms` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fk_pcg_version` varchar(32) NOT NULL,
  `pcg_type` varchar(60) DEFAULT NULL,
  `account_number` varchar(32) NOT NULL,
  `account_parent` int(11) DEFAULT 0,
  `label` varchar(255) NOT NULL,
  `labelshort` varchar(255) DEFAULT NULL,
  `fk_accounting_category` int(11) DEFAULT 0,
  `fk_user_author` int(11) DEFAULT NULL,
  `fk_user_modif` int(11) DEFAULT NULL,
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `reconcilable` tinyint(4) NOT NULL DEFAULT 0,
  `import_key` varchar(14) DEFAULT NULL,
  `extraparams` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`rowid`),
  UNIQUE KEY `uk_accounting_account` (`account_number`,`entity`,`fk_pcg_version`),
  KEY `idx_accounting_account_fk_pcg_version` (`fk_pcg_version`),
  KEY `idx_accounting_account_account_parent` (`account_parent`),
  CONSTRAINT `fk_accounting_account_fk_pcg_version` FOREIGN KEY (`fk_pcg_version`) REFERENCES `llxbx_accounting_system` (`pcg_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `llxbx_accounting_bookkeeping`
--

DROP TABLE IF EXISTS `llxbx_accounting_bookkeeping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `llxbx_accounting_bookkeeping` (
  `rowid` int(11) NOT NULL AUTO_INCREMENT,
  `ent