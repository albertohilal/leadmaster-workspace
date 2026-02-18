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
  `message_id` varchar(255) DEFAULT NULL COMMENT 'ID del mensaje en WhatsApp (trazabilidad con Session Manager)',
  `lugar_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_unico_envio` (`campania_id`,`telefono_wapp`),
  KEY `idx_envios_lugar_camp_estado` (`lugar_id`,`campania_id`,`estado`),
  KEY `idx_envios_camp_estado` (`campania_id`,`estado`),
  KEY `idx_message_id` (`message_id`),
  CONSTRAINT `ll_envios_whatsapp_ibfk_1` FOREIGN KEY (`campania_id`) REFERENCES `ll_campanias_whatsapp` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5191 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_envios_whatsapp_historial` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `envio_id` int(11) NOT NULL,
  `estado_anterior` enum('pendiente','enviado','error') NOT NULL COMMENT 'Estados oficiales Política v1.2.0',
  `estado_nuevo` enum('pendiente','enviado','error') NOT NULL COMMENT 'Estados oficiales Política v1.2.0',
  `origen` varchar(50) NOT NULL,
  `detalle` text DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL COMMENT 'Usuario que realizó cambio manual (auditoría)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_envio_id` (`envio_id`),
  KEY `idx_historial_usuario` (`usuario_id`),
  CONSTRAINT `fk_envio_historial` FOREIGN KEY (`envio_id`) REFERENCES `ll_envios_whatsapp` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_historial_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
