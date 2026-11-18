# Tareas: Ads Holistic (Proyectovv)

> Escrito a partir del repo en `6165fef` (`git log -15`) y de `docs/`, el 2026-11-06. Al escribirlo, `origin/main` ya iba 10 commits por delante. Cada punto cita su fuente; donde no hay evidencia se dice.
> **Auth (Clerk, `/sign-in`, `/sign-up`, correo de código) actualizado a `70da478` el 2026-11-13.** El resto sigue como se escribió en `6165fef`.

## Sprint activo (según los últimos commits)
| Tarea | Estado | Evidencia |
|---|---|---|
| Excluir la deuda de clientes **prepago confirmados** | En `main` | `6165fef` «exclude confirmed prepaid debt and noncash receipt history», `80761a3`, `70afb8e`; `isConfirmedAdsPrepaid` en `lib/hecom/debt-core.cjs` |
| **Prohibir los ajustes que no son efectivo** | En `main` y aplicado en la base | `19a92ba`; migración `20261103210000_block_non_cash_wallet_adjustments.sql` (trigger `reject_non_cash_wallet_adjustment`); `isNonCashAdjustment` en `debt-core.cjs` |
| Cargos mensuales Hecom alineados a los céntimos del estado de cuenta | En `main` | `a86ddcf` |
| Suspender el crédito de agencia y bloquear campañas de cuentas suspendidas | En `main` | `d3dc73d`, `030d9c3`, `0752e2d`, `c1209b3` |
| **Destrabar cuentas TikTok en $0** con `/api/jobs/tiktok/sync` | **Documento viejo** | Es la «Prioridad 2» de `docs/PROXIMOS_PASOS.md`, cuyo último cambio es del **2026-07-24**. Ningún commit reciente lo menciona. El job está programado `*/30` en `vercel.json`. Confirmar si todavía aplica |
| **Receta de Profit Radar (MVP)** | Backend en `main`, detrás de bandera | `docs/PLAN_PROFIT_RADAR.md` (2026-10-12): «fases 1 y 2 (backend) en `main`»; desde el 12/10 el Radar no guarda videos (migración 064). Existen `lib/radar/recipe.server.ts` (+ `recipe.test.ts`) y `/api/profit/radar/recipe`. Depende de `PROFIT_RADAR_ENABLED` (false por defecto) y `PROFIT_RADAR_STAFF_ONLY` (true por defecto) |
| Login Clerk en español con código por correo y precheck (solo staff y clientes Hecom) | En `main` (`70da478`) | `e5037b9` (español), `67833bf` (registro con código), `a848d52` (endurecimiento), `ac1e8d3` (formulario propio + 20/min por IP), `70da478` (sin `profiles`) |
| Rediseño del correo del código (crema, modo oscuro, pie blanco) | En `main` y en la plantilla de Clerk | `335cc66` → `dc2f1b7`; la plantilla `verification_code` de Clerk se actualizó por API |

## Backlog inmediato
| Tarea | Estado real | Evidencia |
|---|---|---|
| **Pulir la interfaz del vendedor** | Solo hay una nota vieja | `docs/PROXIMOS_PASOS.md` (2026-07-24): «Daniel: pulir login, overview y wallet». `PRODUCT.md` (2026-10-11) define al usuario principal como el «vendedor pequeño de Perú». No hay un plan más reciente |
| **Push en iOS** | Sin empezar en el backend | El shell de Capacitor existe en `mobile/` con `@capacitor/push-notifications` 8.1.2. Según `mobile/README.md`, falta el certificado APNs, la tabla de tokens y los avisos de pago. `device_push_tokens` y `POST /api/device/push-token` (`docs/PLAN_APP_IOS_ADSHOLISTIC.md`) **no existen**. Lo que sí hay es push web (`web_push_subscriptions`, `/api/push/subscribe`) |
| **Revisar `/sign-in` en producción** | Pendiente | El build de `ac1e8d3` quedó READY, pero la tarjeta propia (pasos 1 y 2) no se vio en un navegador: el Chrome de pruebas tiene sesión y `.env.local` no trae las claves de Supabase para levantarla en local |
| **Recarga automática en PEN** | **No hay un plan con ese alcance** | Hay dos documentos separados: `docs/SPEC_RECARGA_PEN_V1.md` (2026-08-26), recarga **manual** en PEN vía Stripe `currency=pen`, con su checklist de fase 1 sin marcar; y `docs/MAP_RECARGA_AUTOMATICA_B_C.md`, **pausado** el 2026-09-08. La recarga por calendario está fija en `false` en `lib/payments/auto-recharge/auto-recharge.server.ts:29` (`CALENDAR_AUTO_RECHARGE_ENABLED`). Definir el alcance antes de planificar |

## Observaciones de QA y operación
- **Reglas del incidente del 2026-11-02** (`docs/INCIDENTE_COBROS_HISTORICOS_20261102.md`):
  - El abono confirmado amortiza deuda. No se reutilizan cobros históricos como saldo actual.
  - El cron de reclasificación queda retirado.
  - Prohibido crear garantías, recibos o gastos sintéticos. Los gastos sintéticos antiguos solo se corrigen contra el gasto real de la misma cuenta y día.
  - `lib/hecom/debt-core.cjs` debe seguir idéntico a Hecom `d0c734b8` y pasar `node scripts/test-hecom-debt-settlement.mjs`.
  - Si una lectura queda incompleta, se muestra «saldo por verificar», no se precarga ningún cobro y el snapshot de cobranza falla de forma explícita.
  - La vista de cliente alcanza hasta junio de 2026.
- **Paginación de Supabase:** PostgREST corta en 1000 filas y no existe un helper compartido; cada archivo trae su propia copia:
  - `services/payments.service.ts:459-472` (`selectAllPages`, 1000).
  - `lib/ops/{assistant-brief,assistant-tools,prepago-monitor}.server.ts` (`fetchAll`, 1000).
  - `lib/hecom/debt-settlement.server.ts:19` (`all()`, 500) y `lib/hecom/ads-cliente-cohort.server.ts:15` (500).
  - **Ojo:** `lib/hecom/cliente-dashboard.server.ts:720-727` tiene topes fijos (gastos 400/1500/4000, cobros 25/80/800). Sirve para mostrar, no para calcular deuda.
- **`audit:hecom`** (`package.json`): `node --env-file=.env.local scripts/audit-hecom-clientes-full.mjs`.
  - Variantes: `audit:hecom:dry-run` y `audit:hecom:apply-safe` (`scripts/apply-hecom-stale-fixes.mjs`). `apply-safe` **escribe** en la base.
  - Otros scripts sin entrada en `package.json`: `audit-hecom-proyectovv`, `audit-hecom-saldos`, `realign-hecom-cobro-periodos`.
- **Riesgos ya documentados** en `docs/PROJECT_CONTEXT.md`, 2026-11-04:
  - 9 tablas (`rp_*` y `credit_lock_profiles`) sin RLS y legibles con el rol `anon`.
  - El historial de migraciones de Supabase no refleja lo aplicado.
  - Firma del webhook de Culqi débil.
- **Acceso a clientes Hecom con OTP apagado:** `lib/auth/hecom-otp.server.ts` (`userMayAccessHecomCliente`) devuelve `true` para cualquier cliente cuando `AUTH_HECOM_OTP_LOGIN` está apagado. Confirmar su valor en producción.
- **Correos registrados (2026-11-13, conteo SQL):** 10 staff activos (`staff_members.is_active`), 85 confirmados en `auth.users` y 209 distintos en `clientes.emails` [H] (jsonb). 2 entradas de `clientes.emails` no son correos válidos.
- **Brecha precheck/panel:** el precheck solo deja pasar staff y Hecom. Un usuario con membresía activa o invitación pendiente pero sin ficha en Hecom (que `userMayUsePanel` sí aceptaría) no recibe código en `/sign-in`; el puente de Clerk tampoco lo aceptaría. Confirmar si esos casos existen.
- **Dev local:** `npm run dev` da 500 en todas las rutas si `.env.local` no tiene la URL y la clave anónima de Supabase (`lib/supabase/middleware.ts:9`).
