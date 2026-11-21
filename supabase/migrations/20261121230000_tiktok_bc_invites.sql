-- Invitaciones de clientes a un Business Center de TikTok (BM).
-- El cron /api/jobs/tiktok/bc-invites revisa si aceptaron, les asigna sus cuentas
-- y reinvita cada 6 h mientras sigan pendientes.
create table if not exists public.tiktok_bc_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bc_id text not null,
  email text not null,
  advertiser_ids text[] not null default '{}',
  hecom_cliente_id text,
  organization_id uuid,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'failed', 'cancelled')),
  invite_count integer not null default 0,
  last_invited_at timestamptz,
  accepted_at timestamptz,
  tiktok_user_id text,
  last_error text,
  created_by text
);

create unique index if not exists tiktok_bc_invites_open_uq
  on public.tiktok_bc_invites (bc_id, lower(email))
  where status = 'pending';

create index if not exists tiktok_bc_invites_pending_idx
  on public.tiktok_bc_invites (status, last_invited_at);

alter table public.tiktok_bc_invites enable row level security;
