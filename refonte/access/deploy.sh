#!/bin/bash
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
target="/var/www/myrpgtable/refonte-access/$stamp"
backup="/root/backups/myrpgtable-access-$stamp"
active="/etc/nginx/sites-enabled/myrpgtable.fr"
nginx -t
test ! -e "$target"
test ! -e "$backup"
if pm2 describe myrpgtable-refonte >/dev/null 2>&1; then echo 'Service already exists; inspect before update.'; exit 1; fi
mkdir -p /var/www/myrpgtable/refonte-access
mkdir "$target" "$backup"
cp -a "$active" "$backup/nginx.previous.conf"
tar -xzf "/tmp/myrpgtable-access-$stamp.tar.gz" -C "$target" --no-same-owner
find "$target" -type d -exec chmod 755 {} +
find "$target" -type f -exec chmod 644 {} +
sed "s|__MAINTENANCE_ROOT__|$target/public|g" "$target/public/nginx.conf" > "$backup/nginx.new.conf"
pm2 start "$target/start.mjs" --name myrpgtable-refonte --cwd "$target" --node-args='--env-file=/var/www/myrpgtable/shared/.env' > "$backup/service-start.log" 2>&1
ready=0
for n in $(seq 1 10); do
    code=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4181/auth/status || true)
    if [[ "$code" == 401 ]]; then ready=1; break; fi
    sleep 1
done
if [[ "$ready" != 1 ]]; then pm2 stop myrpgtable-refonte >/dev/null; echo 'Auth service unavailable; public site unchanged.'; exit 1; fi
restore() { cp -a "$backup/nginx.previous.conf" "$active"; nginx -t && systemctl reload nginx; pm2 stop myrpgtable-refonte >/dev/null; }
cp "$backup/nginx.new.conf" "$active"
if ! nginx -t; then restore; exit 1; fi
if ! systemctl reload nginx; then restore; exit 1; fi
sleep 1
base='https://myrpgtable.fr'
for pair in '/:200' '/connexion.html:200' '/connexion.js:200' '/atelier/:302' '/atelier/catalogue.json:302' '/api/GetSupabaseKey:503' '/creer-personnage.html:503'; do
    route=${pair%:*};expected=${pair##*:}
    code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' "$base$route")
    if [[ "$code" != "$expected" ]]; then restore; echo "Check failed: $route"; exit 1; fi
    printf '%s %s\n' "$route" "$code"
done
pm2 save > "$backup/service-save.log" 2>&1
printf 'Access root: %s\nRollback: %s/nginx.previous.conf\n' "$target" "$backup"
