# BeManager — Bitácora del proyecto

Sistema de gestión integral para BeHappy. Desarrollado a medida como reemplazo de Contabilium.

## Stack tecnologico

- Frontend: Next.js 16 + TypeScript
- Estilos: Tailwind CSS + shadcn/ui
- Base de datos: Supabase (PostgreSQL)
- Auth: Supabase Auth
- ARCA: WSFE via SOAP (pendiente)
- Deploy: Vercel + GitHub

## Estructura del negocio

- Puntos de venta: BeHappy Centro, BeHappy Sur (escalable)
- Depositos: BeHappy Centro, BeHappy Sur, Deposito CabildoGym (escalable)
- Roles: Admin (acceso total) / Vendedor (opera su POS asignado)
- Facturacion: Monotributo (C) y SAS (A/B) ambos soportados
- Medios de pago: Efectivo, debito, credito, transferencia
- Precios: IVA incluido en el precio de venta
- Stock se descuenta: Al facturar y al confirmar cotizacion
- Caja: Cierre diario por punto de venta

## Modulos completados

- Auth: login, middleware, roles
- POS: busqueda, carrito, cobro, descuentos, cotizaciones, facturas
- Productos: CRUD, filtros, ordenamiento, etiquetas, historial precios, exportar
- Stock: multi-deposito, alertas, ajustes, transferencias, historial
- Clientes: CRUD, filtros, ranking top 10
- Proveedores: CRUD, pagos a proveedores
- Configuracion: ABM categorias

## Pendientes proxima sesion

- Punto de venta por usuario (cada vendedor tiene su POS asignado)
- Gestion de usuarios desde Configuracion
- POS usar punto_venta_id del usuario logueado
- Numeracion correcta de comprobantes
- Reportes: ventas mensuales, productos mas vendidos
- Finanzas: caja, balance, cierre diario
- Importacion masiva Excel
- Integracion ARCA

## Colores BeHappy

- Primary: #00B4D8
- Primary dark: #0096B4
- Primary light: #E0F7FC
- Background: #F8FAFB
- Surface: #FFFFFF
- Text: #0F172A
- Text muted: #64748B
- Border: #E2E8F0
- Danger: #EF4444

## Datos de ejemplo cargados

- 136 productos con stock en 3 ubicaciones
- 20 clientes
- 12 proveedores
- 8 categorias

## Sesiones

- Sesion 1: Relevamiento, stack, DB, setup
- Sesion 2: Login, dashboard, POS, productos, stock, clientes, proveedores
- Sesion 3: En curso
