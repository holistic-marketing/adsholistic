#!/usr/bin/env bash
# Prepara el droplet bluefocus-relay (Ubuntu 24.04). Idempotente: se puede correr de nuevo.
# Uso (como root): bash setup-server.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# 1) Sistema al día + actualizaciones de seguridad automáticas.
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades ca-certificates curl gnupg
dpkg-reconfigure -f noninteractive unattended-upgrades

# 2) Firewall: solo SSH entrante; todo lo saliente permitido.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable

# 3) SSH solo con llave (sin contraseñas).
cat >/etc/ssh/sshd_config.d/99-relay-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
systemctl reload ssh || systemctl reload sshd || true

systemctl enable --now fail2ban

# 4) Node.js 22 LTS (NodeSource).
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# 5) Usuario sin privilegios para el worker.
id relay >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin relay
mkdir -p /opt/bluefocus-relay
chown root:root /opt/bluefocus-relay
chmod 755 /opt/bluefocus-relay

# 6) Archivo de secretos (lo llena el deploy; solo root y relay lo leen).
touch /etc/bluefocus-relay.env
chown root:relay /etc/bluefocus-relay.env
chmod 640 /etc/bluefocus-relay.env

# 7) Zona horaria UTC y sincronización de reloj (los logs y BlueFocus dependen de la hora).
timedatectl set-timezone UTC
timedatectl set-ntp true

echo "OK: servidor preparado. node $(node -v)"
