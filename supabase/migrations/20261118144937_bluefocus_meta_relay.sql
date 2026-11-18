-- BlueFocus (蓝瀚) Meta relay.
-- BlueFocus solo acepta llamadas desde IPs en lista blanca, así que AdsHolistic
-- (Vercel) no llama directo: deja la orden en esta cola y el worker del
-- droplet bluefocus-relay (IP fija 134.209.108.169) la ejecuta.
--
-- Flujo de una recarga:
--   1. La app debita cartera -> cuenta ads (ledger_allocate_to_ad_account) y
--      encola una fila 'pending' con el journal de esa asignación.
--   2. El worker la toma ('submitting'), llama application/facebook/amount_spend
--      y guarda apply_id ('submitted'). Una a la vez (pedido de BlueFocus).
--   3. El worker consulta application/operate_record hasta que BlueFocus la
--      apruebe ('succeeded') o la rechace ('failed' -> devuelve a la cartera).
--   4. Si no se sabe qué pasó (timeout en el envío, etc.) queda 'needs_review':
--      NUNCA se reintenta sola, para no recargar dos veces.

CREATE TABLE IF NOT EXISTS public.bluefocus_meta_topups (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id),
  ad_account_id          uuid NOT NULL REFERENCES public.ad_accounts(id),
  fb_account_id          text NOT NULL,
  amount_cents           bigint NOT NULL CHECK (amount_cents > 0),
  currency               text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  status                 text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','submitting','submitted','succeeded','failed','refunded','needs_review','cancelled')),
  allocation_journal_id  uuid,
  refund_journal_id      uuid,
  idempotency_key        text NOT NULL UNIQUE,
  bf_apply_id            bigint,
  bf_request_id          text,
  bf_last_code           integer,
  bf_last_info           text,
  bf_reason              text,
  attempts               integer NOT NULL DEFAULT 0,
  requested_by           uuid,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  submitted_at           timestamptz,
  last_polled_at         timestamptz,
  finished_at            timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bluefocus_meta_topups_status_idx
  ON public.bluefocus_meta_topups (status, created_at);
CREATE INDEX IF NOT EXISTS bluefocus_meta_topups_ad_account_idx
  ON public.bluefocus_meta_topups (ad_account_id, created_at DESC);

-- Último saldo/estado que BlueFocus reporta por cuenta Meta (lo escribe el worker).
CREATE TABLE IF NOT EXISTS public.bluefocus_meta_account_snapshots (
  fb_account_id   text PRIMARY KEY,
  account_name    text,
  entity_name     text,
  account_status  integer,
  balance         numeric,
  currency        integer,
  raw             jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at       timestamptz NOT NULL DEFAULT now()
);

-- Latido del worker: la app puede avisar si el relay dejó de responder.
CREATE TABLE IF NOT EXISTS public.bluefocus_relay_heartbeat (
  id            text PRIMARY KEY DEFAULT 'main',
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  egress_ip     text,
  version       text,
  last_error    text,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Solo service role (app server + worker). Sin políticas = nadie más lee/escribe.
ALTER TABLE public.bluefocus_meta_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluefocus_meta_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluefocus_relay_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluefocus_meta_topups FROM anon, authenticated;
REVOKE ALL ON public.bluefocus_meta_account_snapshots FROM anon, authenticated;
REVOKE ALL ON public.bluefocus_relay_heartbeat FROM anon, authenticated;

-- El worker toma UNA orden pendiente de forma atómica (sin carreras si
-- algún día corren dos workers).
CREATE OR REPLACE FUNCTION public.bluefocus_claim_next_meta_topup()
RETURNS SETOF public.bluefocus_meta_topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.bluefocus_meta_topups t
     SET status = 'submitting',
         attempts = t.attempts + 1,
         updated_at = now()
   WHERE t.id = (
     SELECT id FROM public.bluefocus_meta_topups
      WHERE status = 'pending'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
   )
  RETURNING t.*;
END;
$$;

REVOKE ALL ON FUNCTION public.bluefocus_claim_next_meta_topup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bluefocus_claim_next_meta_topup() TO service_role;
