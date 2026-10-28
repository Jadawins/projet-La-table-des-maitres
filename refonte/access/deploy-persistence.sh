#!/bin/bash
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
previous=/var/www/myrpgtable/refonte-access/20261028T062037Z
target="/var/www/myrpgtable/refonte-access/$stamp"
backup="/root/backups/myrpgtable-persistence-$stamp"
active=/etc/nginx/sites-enabled/myrpgtable.fr
grep -Fq "root $previous/public;" "$active"
nginx -t
test ! -e "$target"
test ! -e "$backup"
mkdir "$target"
mkdir -m 700 "$backup"
cp -a "$active" "$backup/nginx.previous.conf"
tar -xzf "/tmp/myrpgtable-persistence-$stamp.tar.gz" -C "$target" --no-same-owner
node --check "$target/server.mjs"
node --check "$target/start.mjs"
node --env-file=/var/www/myrpgtable/shared/.env "$target/backup-db.mjs" "$backup/database.ejsonl.gz"
test -s "$backup/database.ejsonl.gz"
gzip -t "$backup/database.ejsonl.gz"
node --env-file=/var/www/myrpgtable/shared/.env "$target/check-persistence.mjs"
sed "s|__MAINTENANCE_ROOT__|$target/public|g" "$target/public/nginx.conf" > "$backup/nginx.new.conf"
restore(){
  cp -a "$backup/nginx.previous.conf" "$active"
  pm2 delete myrpgtable-refonte >/dev/null 2>&1 || true
  pm2 start "$previous/start.mjs" --name myrpgtable-refonte --cwd "$previous" --node-args='--env-file=/var/www/myrpgtable/shared/.env' > "$backup/restore-service.log" 2>&1
  nginx -t && systemctl reload nginx
  pm2 save > "$backup/restore-save.log" 2>&1
}
pm2 delete myrpgtable-refonte > "$backup/previous-service.log" 2>&1
if ! pm2 start "$target/start.mjs" --name myrpgtable-refonte --cwd "$target" --node-args='--env-file=/var/www/myrpgtable/shared/.env' > "$backup/service-start.log" 2>&1; then restore; exit 1; fi
ready=0
for n in $(seq 1 15);do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4181/auth/status || true)
  if [[ "$code" == 401 ]];then ready=1;break;fi
  sleep 1
done
if [[ "$ready" != 1 ]];then restore;echo 'Service not ready; previous version restored.';exit 1;fi
cp "$backup/nginx.new.conf" "$active"
if ! nginx -t;then restore;exit 1;fi
if ! systemctl reload nginx;then restore;exit 1;fi
sleep 1
for pair in '/:200' '/connexion.html:200' '/atelier/:302' '/atelier/api/personnages:401' '/api/GetSupabaseKey:503' '/creer-personnage.html:503';do
  route=${pair%:*};expected=${pair##*:}
  code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' "https://myrpgtable.fr$route")
  if [[ "$code" != "$expected" ]];then restore;echo "Check failed: $route";exit 1;fi
  printf '%s %s\n' "$route" "$code"
done
pm2 save > "$backup/service-save.log" 2>&1
printf 'Persistence deployed: %s\nBackup and rollback: %s\n' "$target" "$backup"
