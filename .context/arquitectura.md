# Arquitectura: Ads Holistic (Proyectovv)

> Escrito a partir del repo en `6165fef`, el 2026-11-06. Al escribirlo, `origin/main` ya iba 10 commits por delante, así que conviene revisar lo nuevo antes de fiarse de cada detalle.
> Cada afirmación cita su archivo. Donde el pedido original suponía algo distinto a lo que muestra el código, va marcado como **Corrección**.
> **Auth (Clerk, `/sign-in`, `/sign-up`, correo de código) actualizado a `70da478` el 2026-11-13.** El resto sigue como se escribió en `6165fef`.

## 1. Stack (`package.json`)
| Pieza | Versión real | Nota |
|---|---|---|
| Next.js | `16.2.10` | **Corrección:** versión estable, no canary. `build` = `next build --webpack`. |
| React / React DOM | `19.2.4` | |
| Clerk | `@clerk/nextjs ^7.8.2` (instalado 7.8.2), `@clerk/localizations` | Es opcional (ver §2 y §8). Siempre en español (`lib/auth/clerk-localization.ts`). |
| Supabase | `@supabase/ssr ^0.12.0`, `@supabase/supabase-js ^2.110.0` | |
| Tailwind | `tailwindcss ^4` + `@tailwindcss/postcss ^4` | |
| i18n | `next-intl ^4.14.3` | Textos en `messages/{es,en,pt-BR}.json` (`PRODUCT.md`). |
| Correo entrante | `imapflow`, `mailparser`, `mailauth` | Buzón de Yape (`/api/jobs/yape-mailbox`). |
| Push web | `web-push ^3.6.7` | `lib/push/send-web-push.server.ts`, tabla `web_push_subscriptions`. |
| Node | `engines.node = 24.x` | |
| iOS | **No está en el `package.json` raíz.** | Capacitor 8 vive en `mobile/` (`mobile/package.json`, `mobile/capacitor.config.ts`: appId `com.adsholistic.app`, carga `https://www.adsholistic.com` o `CAPACITOR_SERVER_URL`; Xcode en `mobile/ios/App`). |

## 2. Sesión y enrutamiento (`proxy.ts`)
- **Corrección:** `proxy.ts` es la convención que reemplaza a `middleware` en Next 16 y corre en **Node.js, no en edge**. No admite la opción `runtime` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, sección «Runtime»).
- **Entrada:** `proxy()`. Si `clerkLoginEnabled()` es true, pasa por `clerkMiddleware`; si no, va directo a `runHolisticProxy`.
- **Cuándo Clerk está activo** (`lib/auth/clerk.ts`): necesita las claves; en producción, además, el modo satélite (`NEXT_PUBLIC_CLERK_IS_SATELLITE` + `NEXT_PUBLIC_CLERK_DOMAIN`, compartido con impoerp.com); y `AUTH_CLERK_LOGIN` debe ser true o no estar definido.
- **Qué hace `runHolisticProxy`:**
  - Llama a `updateSession` (`lib/supabase/middleware.ts`), que renueva la cookie de Supabase. Es el **único** lugar que persiste el token renovado.
  - Redirige según: admin (`userIsAllowedAdmin`), correo confirmado (→ `/verify-otp`, con `flow=hecom` si `AUTH_HECOM_OTP_LOGIN=true`), acceso al panel (`userCanAccessDashboard` → `/overview` o `/account-setup`), rutas solo para invitados, `/contrato` y `/pago`.
- **`matcher`:** lista explícita, comprobada por `lib/auth/proxy-matcher.test.ts`. Las páginas públicas (`/comprar`, `/carrito`, `/libro-de-reclamaciones`, `/terminos`, `/devoluciones`) quedan fuera.
- **Grupos de rutas** (`config/auth.ts`): `protectedRoutes`, `authRoutes`, `guestOnlyRoutes` y `isAdminProtectedPath` (`/admin/*` menos login y unauthorized).
- **Sesión en el servidor** (`lib/auth/session.server.ts`): `getSession()` usa `cache()` y lee `profiles` + la **primera** `organization_memberships` activa + `organizations`.
  - El rol por defecto es `viewer`.
  - Permisos: `getPermissionsForRole(role, { staffPayments })`. `staffPayments` es true si el correo está en el staff de OTP o si el tester eligió el modo `gerente`.
  - El correo que cuenta para saber quién es staff es el de Auth, no el de `profiles` (que el propio usuario puede editar).
  - `requireVerifiedSession()` exige correo confirmado, perfil `active` y una organización.
- **OTP Hecom** (`lib/auth/hecom-otp.server.ts`): para clientes del CRM, los busca por correo en `clientes` [Hecom]. Tiene un enfriamiento entre pedidos en `hecom_otp_rate_limits`, crea el enlace con `admin.auth.admin.generateLink` y vincula al usuario en `hecom_cliente_user_links`.
  - **Ojo:** `userMayAccessHecomCliente` devuelve `true` para cualquier cliente cuando `isHecomOtpLoginEnabled()` es false.
- **Modo tester** (`lib/auth/tester-dashboard-mode.server.ts`): una cookie httpOnly de 400 días que, para los correos autorizados, alterna la vista cliente/gerente. `sessionIsGerente()` = staff real o tester en modo gerente.
- **Cliente admin** (`lib/supabase/admin.ts`): `createAdminClient()` con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, sin persistir sesión. Solo en el servidor; lo usa casi todo el acceso financiero.

## 3. Límites entre tenants
- **Tenant de Ads:** `organizations` + `organization_memberships` (rol `app_role`: owner, admin, advertiser, finance, viewer, support). Las políticas RLS usan `has_org_role`, `is_org_member` y `user_has_org_access`.
- **Tenant de negocio Hecom:** el «cliente» vive en otro proyecto de Supabase (Hecom CRM). Se lee con `createHecomAdminClient()` (`lib/hecom/supabase.server.ts`; por defecto `fsnolvozwcnbyuradiru.supabase.co`, clave `HECOM_SUPABASE_SERVICE_ROLE_KEY`).
  - Tablas Hecom que se leen: `clientes`, `cobros`, `gastos`, `cliente_tiktok_cuentas`, `tiktok_spend_snapshots`, `creativos_clientes`, `creativos_proyectos`.
  - El puente hacia Ads es `hecom_cliente_user_links` (usuario ↔ cliente) y `resolveOrganizationIdForHecomCliente`.
- **«Ver como cliente»** (`lib/hecom/selected-cliente.server.ts:15-18, 89-118`):
  - Usa las cookies `vv_hecom_act_as_cliente`, `vv_hecom_cliente_id`, `vv_hecom_cliente_name` y `vv_hecom_cliente_owner`.
  - `getActingAsCliente` solo vale si el dueño de la cookie es la sesión actual y la sesión es staff; una cookie que un cliente ponga a mano no le cambia la vista.
  - Se activa con `POST /api/clientes/seleccionar`, que responde 403 si no es admin ni gerente.
  - La vista se aplica con `withActAsClienteView` (`lib/payments/funding-roles.server.ts:127`) y el aviso en pantalla es `components/layout/ActingAsClienteBanner.client.tsx`.
- **Base compartida:** el proyecto Supabase principal también tiene tablas de otras apps (`impo_*`, `rp_*`) (`docs/PROJECT_CONTEXT.md`).

## 4. Ledger de doble entrada
- **Esquema:** `supabase/migrations/006_professional_financial_ledger.sql` crea `ledger_accounts`, `ledger_journals` y `ledger_entries` (dirección `debit`/`credit`).
  - El trigger `prevent_posted_ledger_entry_mutation` bloquea UPDATE y DELETE de asientos ya contabilizados («Use ledger_reverse_journal instead»).
  - `assert_ledger_journal_balanced` verifica que cada asiento cuadre.
- **Saldos derivados:** las vistas `v_wallet_ledger_balances` y `v_ad_account_ledger_balances` (leídas en `lib/ledger/ledger.server.ts:210, 288, 321`).
- **Escrituras, solo por RPC con el service role** (`lib/ledger/ledger.server.ts`): `ledger_confirm_deposit`, `ledger_allocate_to_ad_account`, `ledger_reserve_ad_account_budget`, `ledger_release_ad_account_budget`, `ledger_record_ad_spend`, `ledger_refund_from_ad_account_to_wallet`, `ledger_reverse_journal`, `ensure_wallet_ledger_accounts`, `ensure_ad_account_ledger_accounts`. Fuera de este archivo, el sistema legado usa `post_wallet_transaction`.
- **Sin abonos directos al cliente:** `ledger_journals` y `ledger_entries` solo tienen políticas SELECT para `authenticated`; las escrituras van por RPC `SECURITY DEFINER`.
  - Desde `20261103210000_block_non_cash_wallet_adjustments.sql`, el trigger `reject_non_cash_wallet_adjustment` en `payment_intents` y `ledger_journals` rechaza los ajustes de cartera que no son efectivo.

## 5. Integración TikTok (Business Center de la agencia)
- **Código:** `lib/integrations/tiktok/` (`bc-finance.server.ts`, `client.server.ts`). Los clientes usan cuentas del BC de Holistic y no conectan su propio TikTok (`PRODUCT.md`).
- **Tokens:** la conexión OAuth está en `integration_connections`. `ENCRYPTION_KEY` está en `lib/env/env.server.ts`, y el `PROJECT_CONTEXT.md` de la raíz describe «credenciales cifradas».
- **Fondeo:**
  - `allocateWithOptionalTikTokFunding` (`lib/payments/allocate-with-tiktok.server.ts:163`): presupuesto compartido en BM 10/30, `POST /bc/transfer/` en BM 200/300.
  - Interruptores `TIKTOK_BC_FUNDING_ENABLED` y `TIKTOK_MULTI_TIER_BC_ENABLED`, ambos false por defecto (`env.server.ts:346, 352`).
- **Jobs** (`vercel.json`):
  - `tiktok/sync` (`*/30`): gasto → `ledger_record_ad_spend`.
  - `tiktok/spend-snapshot` (`*/10`).
  - `tiktok/map-accounts` (`40 * * * *`).
  - `prepago-guard` (`*/15`): solo baja presupuestos.
  - Autenticación: `CRON_SECRET` o `INTERNAL_JOB_SECRET`.

## 6. Pasarelas de pago (`lib/payments/providers/`)
- **Pasarelas definidas** (`PaymentGatewayId`, `types/payment.ts`): `stripe | culqi | mercadopago | manual | crypto | cobrana | whop`. Webhook común en `app/api/webhooks/payments/[provider]/route.ts`.
- **Stripe (USD):** solo con `STRIPE_PAYMENTS_ENABLED=true` (`lib/payments/stripe-policy.ts`; el comentario dice que Stripe cerró la cuenta anterior el 05/10/2026). `STRIPE_STAFF_ONLY` está activo salvo que valga `false`.
- **Whop (USD):** en mantenimiento (`gateway-config.ts`).
- **Culqi y MercadoPago:** ocultas en `gateway-config.ts`. En `main`, Culqi no crea cargos.
- **Cobrana (PEN, Yape/Plin):** **Corrección:** es una pasarela con API propia (`cobrana.provider.ts`), no un depósito manual. Por defecto usa la URL de certificación.
- **Manual (BCP, vouchers, Yape por correo):** USD y PEN, convertidos con tipo de cambio. En producción requiere `PAYMENTS_MANUAL_ENABLED` o `PAYMENTS_ALLOW_MANUAL_PROVIDER`.
- **Cripto:** NOWPayments.

## 7. Liquidación FIFO de la deuda Hecom (regla de paridad)
- **Motor:** `lib/hecom/debt-core.cjs` es una **copia exacta** de `api/credito-deuda-core.js` de Hecom (commit `d0c734b8`). Cualquier cambio debe mantener la paridad y pasar `node scripts/test-hecom-debt-settlement.mjs` (`docs/INCIDENTE_COBROS_HISTORICOS_20261102.md`).
- **Cómo aplica los pagos** (`buildGastoSettlementByFifo`, cabecera del archivo):
  - Los cobros con `gasto_id` se imputan a su línea.
  - Los cobros solo con `client_id` se agrupan por el mes en que cuentan y, dentro de cada mes, se aplican por FIFO.
  - El sobrante no pasa a otro período.
  - Las garantías no reducen la deuda.
- **Exclusiones:**
  - Los ajustes que no son efectivo (`ajuste`, `saldo a favor`, `condonacion`, código `AJ-`) cuentan 0 (`isNonCashAdjustment`).
  - El recargo de pasarela solo se descuenta si hay un desglose validado (`validatedPaymentBreakdown`).
  - Los clientes prepago confirmados se excluyen (`isConfirmedAdsPrepaid`).
- **Prohibido** (`docs/INCIDENTE_COBROS_HISTORICOS_20261102.md`): reclasificar cobros para cuadrar meses; crear garantías, recibos o gastos sintéticos; restar totales mensuales en lugar de usar el motor; reglas propias de garantía o pasarela en el adaptador.
- **Lectura incompleta:** si una fuente falla, se muestra «saldo por verificar» y no se precarga ningún cobro. La deuda exige el historial completo, leído página por página.

## 8. Login con Clerk (estado a `70da478`, 2026-11-13)
- **Pantallas en español:** `getClerkLocalization()` (`lib/auth/clerk-localization.ts`) devuelve siempre `esES` con textos propios, validados con `satisfies`. Lo usa `app/layout.tsx`. La cookie `NEXT_LOCALE=en` ya no cambia Clerk a inglés.
- **`/sign-in`:** formulario propio `features/auth/components/ClerkPasswordlessSignIn.client.tsx` (hook `useSignIn`, código de 6 dígitos por correo), con la misma tarjeta que `<SignIn />` (estilos de `lib/auth/clerk-appearance.ts`). Ya no se usa `<SignIn />` ni el parche de `window.fetch`.
  - Pasos: correo → `POST /api/auth/clerk/precheck` → `signIn.create` → `signIn.emailCode.sendCode()` → `verifyCode` → `finalize` → `/auth/clerk/complete`.
  - Paso 2: seis casillas, lápiz para editar el correo y «Reenviar (XX)» con espera de 30 s.
  - Si ya hay sesión de Clerk, la página salta directo a `/auth/clerk/complete`.
- **Precheck** (`app/api/auth/clerk/precheck/route.ts`): decide quién recibe código.
  - Solo pasa staff (`isStaffUser`) o un correo con ficha en `clientes` [Hecom]. Desde `70da478` **ya no** basta una fila en `profiles` (dejaba entrar cuentas solo de ImpoERP).
  - Límite: 20 consultas por minuto por IP, en `hecom_otp_rate_limits` con clave `clerk-precheck:<ip>`. No hay pausa entre intentos.
  - Si el correo pasa y no existe en Clerk, lo crea (`createUser({ emailAddress, skipPasswordRequirement: true })`; el correo queda verificado).
  - Respuestas: 403 «no está registrado», 429 límite, 503 Hecom caído, 502 fallo de Clerk.
- **`/sign-up`:** `ClerkPasswordlessSignUp.client.tsx` con código por correo (`email_code`). Ya no se usa `withSignUp`. Pide nombre y celular, que el puente necesita para crear la ficha en Hecom.
- **Puente** `/auth/clerk/complete` (`lib/auth/clerk-bridge.server.ts`, `completeClerkLoginToHolistic`):
  - Pide un correo principal verificado.
  - `assertHecomAccess` acepta solo staff o clientes Hecom; un registro nuevo crea su ficha en Hecom.
  - Luego asegura el usuario de Supabase y abre la sesión de Holistic con un magic link generado en el servidor.
  - Los rechazos vuelven a `/sign-in?error=…` (`CLERK_BRIDGE_ERRORS` en `lib/auth/clerk-errors.ts`).
- **Acceso al panel** (`lib/auth/panel-access.server.ts`, `userMayUsePanel`): membresía activa, staff, Hecom o invitación pendiente. Si Hecom no responde, se niega. No revisa `auth.users` ni `profiles`.
- **Staff:** tabla `staff_members` (`is_active`), leída en `lib/auth/staff.server.ts` (`isStaffUser`, `listStaffEmails`).
- **Respaldo:** si el formulario no carga en 8 s, `ClerkLoadFallback.client.tsx` ofrece `/login?codigo=1`. Reconoce el formulario propio por `[data-clerk-ready]`.
- **Correo del código:** `lib/email/templates/verification-code.ts` (crema, con modo oscuro). Lo usan el OTP propio (`lib/email/auth-otp.server.ts`) y la plantilla `verification_code` de Clerk, que se sube por la API de Clerk (no se despliega con el repo).
- **Endurecimiento `a848d52`:** `lib/auth/otp-lookup-token.server.ts`, `lib/auth/server-sign-out.server.ts` (cierra Clerk y Supabase) y el filtro Hecom/staff en el panel.
