-- ============================================================
-- INVENTARIO EPP - Seed SQL
-- ============================================================

-- Conectado a la BD configurada en .env

-- -----------------------------------------------------------
-- USUARIOS
-- -----------------------------------------------------------
INSERT INTO `usuarios` (`nombre`, `username`, `password_hash`, `rol`, `estado`) VALUES
-- USUARIO ADMIN: Cambiar 'CAMBIA_ESTO' por tu contraseña real antes de ejecutar
-- O usar: INSERT INTO usuarios ... SHA2(CONCAT('usuario', ':epp2026:', 'tu_contraseña'), 256)
('Administrador', 'admin', SHA2(CONCAT('admin', ':epp2026:', 'CAMBIA_ESTO'), 256), 'ADMIN', 'ACTIVO');


-- -----------------------------------------------------------
-- EPP
-- -----------------------------------------------------------
INSERT INTO `epp` (`nombre`, `descripcion`, `estado`) VALUES
('Casco',    'Casco de seguridad industrial', 'ACTIVO'),
('Chaleco',  'Chaleco de seguridad reflectivo', 'ACTIVO'),
('Polo',     'Polo de trabajo', 'ACTIVO'),
('Pantalón', 'Pantalón de trabajo', 'ACTIVO'),
('Botas',    'Botas de seguridad', 'ACTIVO'),
('Guantes',  'Guantes de protección', 'ACTIVO');

-- -----------------------------------------------------------
-- TALLAS MAESTRAS
-- -----------------------------------------------------------
INSERT INTO `tallas` (`nombre`, `orden`, `estado`) VALUES
('S',   1,  'ACTIVO'),
('M',   2,  'ACTIVO'),
('L',   3,  'ACTIVO'),
('XL',  4,  'ACTIVO'),
('XXL', 5,  'ACTIVO'),
('35',  6,  'ACTIVO'),
('36',  7,  'ACTIVO'),
('37',  8,  'ACTIVO'),
('38',  9,  'ACTIVO'),
('39',  10, 'ACTIVO'),
('40',  11, 'ACTIVO'),
('41',  12, 'ACTIVO'),
('42',  13, 'ACTIVO'),
('43',  14, 'ACTIVO'),
('44',  15, 'ACTIVO'),
('45',  16, 'ACTIVO');

-- -----------------------------------------------------------
-- EPP_TALLAS - Relaciones N:M
-- -----------------------------------------------------------
-- Casco: S M L XL XXL
INSERT INTO `epp_tallas` (`epp_id`, `talla_id`) SELECT e.id, t.id FROM `epp` e, `tallas` t WHERE e.nombre = 'Casco' AND t.nombre IN ('S','M','L','XL','XXL');

-- Chaleco: S M L XL XXL
INSERT INTO `epp_tallas` (`epp_id`, `talla_id`) SELECT e.id, t.id FROM `epp` e, `tallas` t WHERE e.nombre = 'Chaleco' AND t.nombre IN ('S','M','L','XL','XXL');

-- Polo: S M L XL XXL
INSERT INTO `epp_tallas` (`epp_id`, `talla_id`) SELECT e.id, t.id FROM `epp` e, `tallas` t WHERE e.nombre = 'Polo' AND t.nombre IN ('S','M','L','XL','XXL');

-- Pantalón: S M L XL XXL
INSERT INTO `epp_tallas` (`epp_id`, `talla_id`) SELECT e.id, t.id FROM `epp` e, `tallas` t WHERE e.nombre = 'Pantalón' AND t.nombre IN ('S','M','L','XL','XXL');

-- Guantes: S M L XL XXL
INSERT INTO `epp_tallas` (`epp_id`, `talla_id`) SELECT e.id, t.id FROM `epp` e, `tallas` t WHERE e.nombre = 'Guantes' AND t.nombre IN ('S','M','L','XL','XXL');

-- Botas: 35 36 37 38 39 40 41 42 43 44 45
INSERT INTO `epp_tallas` (`epp_id`, `talla_id`) SELECT e.id, t.id FROM `epp` e, `tallas` t WHERE e.nombre = 'Botas' AND t.nombre IN ('35','36','37','38','39','40','41','42','43','44','45');
