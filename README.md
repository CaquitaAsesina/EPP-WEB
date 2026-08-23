# 🛡️ Inventario EPP

Sistema de gestión de inventario de Equipos de Protección Personal (EPP) para la empresa **Punta Negra**.

![Node.js](https://img.shields.io/badge/Node.js-20-green)
![MySQL](https://img.shields.io/badge/MySQL-8.4-blue)
![Express](https://img.shields.io/badge/Express-5-red)
![License](https://img.shields.io/badge/License-ISC-yellow)

---

## 📋 Descripción

Sistema web completo para el control y seguimiento de equipos de protección personal, diseñado para empresas de minería o construcción. Permite gestionar el ciclo de vida completo de los EPP: desde el stock inicial, pasando por ingresos y entregas a trabajadores, hasta las devoluciones y lavado.

### Funcionalidades principales

- **📊 Dashboard** — Resumen visual del inventario por período
- **📦 Stock Inicial** — Registro de inventario base por período
- **📥 Ingresos** — Registro de EPP recibidos de la empresa
- **📤 Entregas** — Entrega de EPP a trabajadores (individual o MUDA completa)
- **🔄 Devoluciones** — Control de devoluciones con flujo de estados (Sucio → En Lavado → Lavado)
- **📋 Sistemático** — Vista consolidada: Stock = Inicial + Ingresos - Entregas + Lavados
- **🔍 Consultas** — Historial completo con filtros por período, tipo y fechas
- **📄 Exportación PDF** — Reportes descargables del dashboard, sistemático y consultas
- **👤 Gestión de usuarios** — Roles: Admin, Almacén, Consulta
- **🔒 Auditoría** — Registro completo de todas las acciones

---

## 🏗️ Arquitectura

```
inventario-epp/
├── backend/
│   ├── config/
│   │   ├── config.js          # Configuración (lee de .env)
│   │   └── database.js        # Pool MySQL con SSL
│   ├── controllers/            # Lógica de cada módulo
│   ├── services/               # Acceso a BD
│   ├── routes/index.js         # Rutas API REST
│   ├── app.js                  # Express app
│   └── server.js               # Punto de entrada
├── frontend/
│   ├── css/style.css           # Estilos (glassmorphism, dark mode)
│   ├── js/
│   │   ├── api.js              # Módulo de comunicación API
│   │   └── app.js              # Lógica del frontend
│   └── index.html              # SPA principal
├── database/
│   ├── schema.sql              # Estructura de tablas
│   └── seed.sql                # Datos iniciales
├── .env                        # Variables de entorno (no subir a git)
├── .gitignore
├── render.yaml                 # Config de deploy en Render
└── package.json
```

---

## 🚀 Instalación

### Requisitos

- Node.js 20+
- MySQL 8.0+ (local o Aiven Cloud)

### Paso 1: Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd inventario-epp
```

### Paso 2: Instalar dependencias

```bash
npm install
```

### Paso 3: Configurar variables de entorno

Copia `.env.example` como `.env` y configura:

```env
# Modo: cloud (Aiven) o local (MySQL)
DB_MODE=local

# Local MySQL
LOCAL_DB_HOST=localhost
LOCAL_DB_PORT=3306
LOCAL_DB_USER=root
LOCAL_DB_PASSWORD=tu_password
LOCAL_DB_NAME=inventario_epp

# Aiven Cloud (solo si DB_MODE=cloud)
DB_HOST=tu-host.aivencloud.com
DB_PORT=26056
DB_USER=avnadmin
DB_PASSWORD=tu_password_aiven
DB_NAME=defaultdb
DB_SSL=true

# JWT
JWT_SECRET=tu_secret_aqui

# Puerto del servidor
PORT=3000
```

### Paso 4: Iniciar el servidor

```bash
npm start
```

El servidor arranca en `http://localhost:3000`. Las tablas y datos iniciales se crean automáticamente.

### Credenciales por defecto

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `CAMBIA_ESTO` |

> ⚠️ Edita `database/seed.sql` y reemplaza `CAMBIA_ESTO` por una contraseña real **antes** de ejecutar el seed, o cámbiala desde la app después del primer login

---

## ☁️ Deploy en Render + Aiven

### 1. Base de datos (Aiven)

1. Crea una cuenta en [Aiven Console](https://console.aiven.io)
2. Crea un servicio MySQL
3. Copia las credenciales de conexión

### 2. Aplicación (Render)

1. Sube el código a GitHub
2. En [Render](https://render.com), crea un **New Web Service**
3. Conecta tu repositorio GitHub
4. Configura las variables de entorno:

| Variable | Valor |
|----------|-------|
| `DB_MODE` | `cloud` |
| `DB_HOST` | *(host de Aiven)* |
| `DB_PORT` | `26056` |
| `DB_USER` | `avnadmin` |
| `DB_PASSWORD` | *(contraseña de Aiven)* |
| `DB_NAME` | `defaultdb` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | *(genera uno aleatorio)* |

5. Deploy automático

---

## 📊 Fórmula del Sistemático

```
STOCK SISTEMÁTICO = Stock Inicial + Ingresos - Entregas + Devoluciones(LAVADO)
```

| Concepto | Descripción | Efecto |
|----------|-------------|--------|
| Stock Inicial | Cantidad base al inicio del período | + |
| Ingresos | EPP recibidos de la empresa | + |
| Entregas | EPP entregados a trabajadores | − |
| Sucios | Devueltos, pendientes de lavado | 0 |
| En Lavado | Mandados a lavar | 0 |
| Lavados | EPP limpios y disponibles | + |

---

## 🔐 Roles

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Acceso total: crear períodos, gestionar usuarios, exportar reportes |
| **ALMACEN** | Registrar stock, ingresos, entregas, devoluciones y cambios de estado |
| **CONSULTA** | Solo lectura: dashboard, sistemático y consultas |

---

## 🗃️ Base de datos

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Usuarios del sistema |
| `epp` | Catálogo de EPP (Casco, Chaleco, Polo, etc.) |
| `tallas` | Catálogo de tallas (S, M, L, XL, 35-45) |
| `epp_tallas` | Relación N:M EPP ↔ Tallas |
| `trabajadores` | Personal de la empresa |
| `periodos` | Períodos de control (activo/inactivo) |
| `stock_inicial` | Inventario base por período |
| `ingresos` | EPP recibidos de la empresa |
| `entregas` | EPP entregados a trabajadores |
| `devoluciones` | EPP devueltos con flujo de estados |
| `devolucion_estados` | Historial de transiciones de devoluciones |
| `inventarios_fisicos` | Conteos físicos de inventario |
| `auditoria` | Registro de todas las acciones |

---

## 🛠️ Tecnologías

- **Backend:** Node.js + Express 5
- **Frontend:** HTML5 + CSS3 + Bootstrap 5 + JavaScript vanilla
- **Base de datos:** MySQL 8.4 (Aiven Cloud)
- **Reportes:** PDFKit (exportación PDF)
- **Autenticación:** JWT (JSON Web Tokens)
- **Seguridad:** bcrypt/SHA-256 para contraseñas, CORS, rate limiting

---

## 📄 Licencia

ISC License
