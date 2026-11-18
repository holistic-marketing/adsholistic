# BlueFocus Meta relay

BlueFocus solo acepta llamadas desde IPs en lista blanca. Vercel no tiene IP fija,
así que las llamadas salen de un droplet propio:

- **Servidor:** DigitalOcean `bluefocus-relay`, SGP1, Ubuntu 24.04, $6/mes
- **IP fija (lista blanca BlueFocus):** `134.209.108.169`
- **Acceso:** `ssh -i ~/.ssh/bluefocus_relay root@134.209.108.169` (solo llave)
- **Servicio:** `systemctl status bluefocus-relay` · logs: `journalctl -u bluefocus-relay -f`
- **Secretos:** `/etc/bluefocus-relay.env` (token BlueFocus, Supabase service role, `RELAY_SUBMIT_ENABLED`)

## Cómo funciona

1. La app debita cartera → cuenta ads y encola una fila `pending` en `bluefocus_meta_topups`.
2. El worker toma una a la vez y llama `application/facebook/amount_spend` → guarda `apply_id` (`submitted`).
3. Consulta `application/operate_record` cada 30 s: `succeeded`, o `failed` → devuelve la plata a la cartera (`refunded`).
4. Si no se sabe qué pasó (timeout, error 5xx, reinicio a mitad del envío) → `needs_review`. Nunca reintenta solo.

Además cada 10 min guarda saldo/estado de las cuentas Meta en `bluefocus_meta_account_snapshots`
y cada minuto un latido en `bluefocus_relay_heartbeat`.

## Operación

- Prueba de solo lectura: `cd /opt/bluefocus-relay && sudo -u relay bash -c 'set -a; . /etc/bluefocus-relay.env; set +a; node worker.mjs --probe'`
- Activar/desactivar envío de recargas: `RELAY_SUBMIT_ENABLED=true|false` en el env + `systemctl restart bluefocus-relay`
- Deploy de cambios: copiar `worker.mjs` a `/opt/bluefocus-relay/` y reiniciar el servicio.
- Preparar un servidor nuevo: `bash setup-server.sh` (firewall, SSH solo llave, fail2ban, Node 22, usuario `relay`).
