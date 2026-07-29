#!/bin/sh
set -e

# Railway no usa el DNS embebido de Docker Compose (127.0.0.11) — cada plataforma resuelve
# *.railway.internal con su propio servidor interno (acá, uno IPv6: "fd12::10"). Se lee el
# resolver real de /etc/resolv.conf del propio contenedor y se arma el formato que nginx exige:
# las IPv6 van entre corchetes ("[fd12::10]:53") o "resolver" falla al arrancar con
# "invalid port in resolver".
RAW_IP="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)"
if [ -z "$RAW_IP" ]; then
  echo "nginx-entrypoint: no se encontró 'nameserver' en /etc/resolv.conf, usando 127.0.0.11 como último recurso" >&2
  RAW_IP="127.0.0.11"
fi

case "$RAW_IP" in
  *:*) RESOLVER_ADDR="[${RAW_IP}]:53" ;;
  *)   RESOLVER_ADDR="${RAW_IP}:53" ;;
esac
export RESOLVER_ADDR
echo "nginx-entrypoint: RAW_IP=${RAW_IP} RESOLVER_ADDR=${RESOLVER_ADDR}"

exec /docker-entrypoint.sh "$@"
