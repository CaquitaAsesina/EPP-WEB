-- ============================================================
-- INVENTARIO EPP - Schema SQL
-- ============================================================

-- CREATE DATABASE se ejecuta dinámicamente en server.js

-- -----------------------------------------------------------
-- 1. USUARIOS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nombre`         VARCHAR(120)  NOT NULL,
  `username`       VARCHAR(50)   NOT NULL UNIQUE,
  `password_hash`  VARCHAR(255)  NOT NULL,
  `rol`            ENUM('ADMIN','ALMACEN','CONSULTA') NOT NULL DEFAULT 'CONSULTA',
  `estado`         ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `creado_el`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_usuarios_rol` (`rol`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 2. EPP
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `epp` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nombre`      VARCHAR(100) NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) NULL,
  `estado`      ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `creado_el`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 3. TALLAS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tallas` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nombre`     VARCHAR(10) NOT NULL UNIQUE,
  `orden`      INT NOT NULL DEFAULT 0,
  `estado`     ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `creado_el`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tallas_orden` (`orden`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 4. EPP_TALLAS (N:M)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `epp_tallas` (
  `id`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `epp_id`   INT UNSIGNED NOT NULL,
  `talla_id` INT UNSIGNED NOT NULL,
  UNIQUE KEY `uk_epp_talla` (`epp_id`, `talla_id`),
  CONSTRAINT `fk_et_epp`   FOREIGN KEY (`epp_id`)   REFERENCES `epp`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_et_talla` FOREIGN KEY (`talla_id`)  REFERENCES `tallas`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 5. TRABAJADORES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trabajadores` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `codigo`     VARCHAR(50) NULL UNIQUE,
  `nombre`     VARCHAR(150) NOT NULL,
  `dni`        VARCHAR(20)  NOT NULL UNIQUE,
  `cargo`      VARCHAR(100) NULL,
  `area`       VARCHAR(30)  NULL,
  `estado`     ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `creado_el`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_trabajadores_nombre` (`nombre`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 6. PERIODOS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `periodos` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `fecha`      DATE NOT NULL UNIQUE,
  `activo`     TINYINT(1) NOT NULL DEFAULT 1,
  `creado_el`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 7. STOCK INICIAL
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_inicial` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `periodo`    DATE NOT NULL,
  `epp_id`     INT UNSIGNED NOT NULL,
  `talla_id`   INT UNSIGNED NOT NULL,
  `cantidad`   INT NOT NULL DEFAULT 0,
  `usuario_id` INT UNSIGNED NULL,
  `creado_el`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_stock_periodo_epp_talla` (`periodo`, `epp_id`, `talla_id`),
  INDEX `idx_stock_epp_talla` (`epp_id`, `talla_id`),
  CONSTRAINT `fk_si_epp`     FOREIGN KEY (`epp_id`)     REFERENCES `epp`(`id`)       ON DELETE CASCADE,
  CONSTRAINT `fk_si_talla`   FOREIGN KEY (`talla_id`)   REFERENCES `tallas`(`id`)     ON DELETE CASCADE,
  CONSTRAINT `fk_si_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 8. INGRESOS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ingresos` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `fecha`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `periodo`    DATE NULL,
  `epp_id`     INT UNSIGNED NOT NULL,
  `talla_id`   INT UNSIGNED NOT NULL,
  `cantidad`   INT NOT NULL,
  `usuario_id` INT UNSIGNED NULL,
  `estado`     ENUM('ACTIVO','ANULADO') NOT NULL DEFAULT 'ACTIVO',
  `creado_el`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`cantidad` > 0),
  INDEX `idx_ingresos_fecha` (`fecha`),
  INDEX `idx_ingresos_epp_talla` (`epp_id`, `talla_id`),
  INDEX `idx_ingresos_estado` (`estado`),
  INDEX `idx_ingresos_estado_periodo` (`estado`, `periodo`, `epp_id`, `talla_id`),
  CONSTRAINT `fk_ing_epp`     FOREIGN KEY (`epp_id`)     REFERENCES `epp`(`id`)       ON DELETE CASCADE,
  CONSTRAINT `fk_ing_talla`   FOREIGN KEY (`talla_id`)   REFERENCES `tallas`(`id`)     ON DELETE CASCADE,
  CONSTRAINT `fk_ing_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 9. ENTREGAS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `entregas` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `fecha`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `periodo`        DATE NULL,
  `trabajador_id`  INT UNSIGNED NOT NULL,
  `epp_id`         INT UNSIGNED NOT NULL,
  `talla_id`       INT UNSIGNED NOT NULL,
  `cantidad`       INT NOT NULL,
  `usuario_id`     INT UNSIGNED NULL,
  `estado`         ENUM('ACTIVO','ANULADO') NOT NULL DEFAULT 'ACTIVO',
  `creado_el`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`cantidad` > 0),
  INDEX `idx_entregas_fecha` (`fecha`),
  INDEX `idx_entregas_epp_talla` (`epp_id`, `talla_id`),
  INDEX `idx_entregas_trabajador` (`trabajador_id`),
  INDEX `idx_entregas_estado` (`estado`),
  INDEX `idx_entregas_estado_periodo` (`estado`, `periodo`, `epp_id`, `talla_id`),
  CONSTRAINT `fk_ent_trab`    FOREIGN KEY (`trabajador_id`) REFERENCES `trabajadores`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ent_epp`     FOREIGN KEY (`epp_id`)        REFERENCES `epp`(`id`)          ON DELETE CASCADE,
  CONSTRAINT `fk_ent_talla`   FOREIGN KEY (`talla_id`)      REFERENCES `tallas`(`id`)        ON DELETE CASCADE,
  CONSTRAINT `fk_ent_usuario` FOREIGN KEY (`usuario_id`)    REFERENCES `usuarios`(`id`)       ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 10. DEVOLUCIONES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devoluciones` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `fecha`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `periodo`         DATE NULL,
  `trabajador_id`   INT UNSIGNED NOT NULL,
  `epp_id`          INT UNSIGNED NOT NULL,
  `talla_id`        INT UNSIGNED NOT NULL,
  `cantidad`        INT NOT NULL,
  `estado`          ENUM('SUCIO','EN_LAVADO','LAVADO','DANADO','PERDIDO','DESCARTADO') NOT NULL DEFAULT 'SUCIO',
  `usuario_id`      INT UNSIGNED NULL,
  `estado_registro` ENUM('ACTIVO','ANULADO') NOT NULL DEFAULT 'ACTIVO',
  `creado_el`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`cantidad` > 0),
  INDEX `idx_devoluciones_estado` (`estado`),
  INDEX `idx_devoluciones_epp_talla` (`epp_id`, `talla_id`),
  INDEX `idx_devoluciones_trabajador` (`trabajador_id`),
  INDEX `idx_devoluciones_registro` (`estado_registro`),
  INDEX `idx_devoluciones_estado_periodo` (`estado_registro`, `estado`, `periodo`, `epp_id`, `talla_id`),
  CONSTRAINT `fk_dev_trab`    FOREIGN KEY (`trabajador_id`) REFERENCES `trabajadores`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dev_epp`     FOREIGN KEY (`epp_id`)        REFERENCES `epp`(`id`)          ON DELETE CASCADE,
  CONSTRAINT `fk_dev_talla`   FOREIGN KEY (`talla_id`)      REFERENCES `tallas`(`id`)        ON DELETE CASCADE,
  CONSTRAINT `fk_dev_usuario` FOREIGN KEY (`usuario_id`)    REFERENCES `usuarios`(`id`)       ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 11. DEVOLUCION_ESTADOS (historial de transiciones)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devolucion_estados` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `devolucion_id`   INT UNSIGNED NOT NULL,
  `estado_anterior` ENUM('SUCIO','EN_LAVADO','LAVADO','DANADO','PERDIDO','DESCARTADO') NULL,
  `estado_nuevo`    ENUM('SUCIO','EN_LAVADO','LAVADO','DANADO','PERDIDO','DESCARTADO') NOT NULL,
  `usuario_id`      INT UNSIGNED NULL,
  `fecha`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dev_estados_devolucion` (`devolucion_id`),
  CONSTRAINT `fk_de_dev`     FOREIGN KEY (`devolucion_id`) REFERENCES `devoluciones`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_de_usuario` FOREIGN KEY (`usuario_id`)    REFERENCES `usuarios`(`id`)     ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 12. INVENTARIOS FISICOS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventarios_fisicos` (
  `id`                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `fecha`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `usuario_id`          INT UNSIGNED NULL,
  `epp_id`              INT UNSIGNED NOT NULL,
  `talla_id`            INT UNSIGNED NOT NULL,
  `stock_sistematico`   INT NOT NULL DEFAULT 0,
  `cantidad_fisica`     INT NOT NULL DEFAULT 0,
  `diferencia`          INT NOT NULL DEFAULT 0,
  `tipo`                ENUM('CONFORME','FALTANTE','SOBRANTE') NOT NULL,
  `creado_el`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_inv_fisico_fecha` (`fecha`),
  INDEX `idx_inv_fisico_epp_talla` (`epp_id`, `talla_id`),
  INDEX `idx_inv_fisico_tipo` (`tipo`),
  CONSTRAINT `fk_if_epp`     FOREIGN KEY (`epp_id`)     REFERENCES `epp`(`id`)       ON DELETE CASCADE,
  CONSTRAINT `fk_if_talla`   FOREIGN KEY (`talla_id`)   REFERENCES `tallas`(`id`)     ON DELETE CASCADE,
  CONSTRAINT `fk_if_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 13. AUDITORIA
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `auditoria` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `usuario_id`       INT UNSIGNED NULL,
  `usuario_nombre`   VARCHAR(120) NULL,
  `fecha`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accion`           VARCHAR(50)  NOT NULL,
  `tabla`            VARCHAR(50)  NOT NULL,
  `registro_id`      INT UNSIGNED NULL,
  `datos_anteriores` JSON NULL,
  `datos_nuevos`     JSON NULL,
  INDEX `idx_auditoria_fecha` (`fecha`),
  INDEX `idx_auditoria_tabla` (`tabla`),
  INDEX `idx_auditoria_registro` (`tabla`, `registro_id`),
  INDEX `idx_auditoria_usuario` (`usuario_id`)
) ENGINE=InnoDB;
