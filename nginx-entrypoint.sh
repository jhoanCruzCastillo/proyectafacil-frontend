#!/bin/sh
set -e

# Railway no usa el DNS embebido de Docker Compose (127.0.0.11) — cada plataforma resuelve
# *.railway.internal con su propio servidor interno, distinto en cada ambiente. Hardcodear una IP
# rompe la resolución por completo (confirmado en logs: "recv() failed (111: Connection refused)
# ... resolver: 127.0.0.11:53" — no hay nada escuchando ahí). En vez de adivinar, se lee el
# resolver real que el propio contenedor ya tiene configurado en /etc/resolv.conf y se exporta como
# variable de entorno para que nginx.conf.template la use vía ${RESOLVER_IP}.
RESOLVER_IP="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)"
if [ -z "$RESOLVER_IP" ]; then
  echo "nginx-entrypoint: no se encontró 'nameserver' en /etc/resolv.conf, usando 127.0.0.11 como último recurso" >&2
  RESOLVER_IP="127.0.0.11"
fi
export RESOLVER_IP
echo "nginx-entrypoint: RESOLVER_IP=${RESOLVER_IP}"

exec /docker-entrypoint.sh "$@"
