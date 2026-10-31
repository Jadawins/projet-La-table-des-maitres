#!/bin/bash
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
previous=/var/www/myrpgtable/refonte-access/20261030T141809Z
target="/var/www/myrpgtable/refonte-access/$stamp"
backup="/root/backups/myrpgtable-persistence-$stamp"
active=/etc/nginx/sites-enabled/myrpgtable.fr
archive="/tmp/myrpgtable-feat-rewrite-$stamp.tar.gz"
checker=/tmp/check-portal-persistence.mjs
test -f "$archive"
test -f "$checker"
test ! -e "$target"
test ! -e "$backup"
grep -Fq "root $previous/public;" "$active"
pm2 describe myrpgtable-refonte | grep -Fq "$previous/start.mjs"
nginx -t
mkdir -m 700 "$backup"
cp -a "$active" "$backup/nginx.previous.conf"
cp -a /var/www/myrpgtable/shared/.env "$backup/env.previous"
chmod 600 "$backup/env.previous"
tar -czf "$backup/previous-release.tar.gz" -C /var/www/myrpgtable/refonte-access "$(basename "$previous")"
node --env-file=/var/www/myrpgtable/shared/.env "$previous/backup-db.mjs" "$backup/database.ejsonl.gz"
gzip -t "$backup/database.ejsonl.gz"
gzip -t "$backup/previous-release.tar.gz"
mkdir "$target"
tar -xzf "$archive" -C "$target" --no-same-owner
for file in admin-store.mjs server.mjs start.mjs character-store.mjs rules-store.mjs import-rules.mjs; do node --check "$target/$file"; done
test ! -e "$target/atelier/catalogue.json"
cp "/tmp/feat-catalogue-$stamp.json" "$backup/catalogue-import-input.json"
cp /tmp/non-srd-feat-rewrite-20261031.json "$backup/editorial-plan.json"
chmod 600 "$backup/catalogue-import-input.json" "$backup/editorial-plan.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-editorial-import.mjs "$previous" "$target" "$backup/catalogue-import-input.json" "$backup/editorial-plan.json" > "$backup/editorial-baseline-check.json"
node --env-file=/var/www/myrpgtable/shared/.env "$target/import-rules.mjs" "$backup/catalogue-import-input.json" "$target/rules-release.json" > "$backup/catalogue-import-result.json"
node --env-file=/var/www/myrpgtable/shared/.env "$checker" "$target" "$backup/persistence-before.json"
sed "s|__MAINTENANCE_ROOT__|$target/public|g" "$target/public/nginx.conf" > "$backup/nginx.new.conf"
cat > "$backup/rollback.sh" <<EOF
#!/bin/bash
set -euo pipefail
cp -a '$backup/nginx.previous.conf' '$active'
cp -a '$backup/env.previous' /var/www/myrpgtable/shared/.env
pm2 delete myrpgtable-refonte >/dev/null 2>&1 || true
pm2 start '$previous/start.mjs' --name myrpgtable-refonte --cwd '$previous' --node-args='--env-file=/var/www/myrpgtable/shared/.env'
nginx -t
systemctl reload nginx
pm2 save
EOF
chmod 700 "$backup/rollback.sh"
changed=0
rollback(){
  rc=$?
  trap - ERR
  if [[ "$changed" == 1 ]]; then bash "$backup/rollback.sh" > "$backup/rollback.log" 2>&1; echo 'Deployment failed; previous release restored.'; fi
  exit "$rc"
}
trap rollback ERR
changed=1
pm2 delete myrpgtable-refonte > "$backup/previous-service.log" 2>&1
pm2 start "$target/start.mjs" --name myrpgtable-refonte --cwd "$target" --node-args='--env-file=/var/www/myrpgtable/shared/.env' > "$backup/service-start.log" 2>&1
ready=0
for n in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4181/auth/status || true)
  if [[ "$code" == 401 ]]; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]]
cp "$backup/nginx.new.conf" "$active"
nginx -t
systemctl reload nginx
for pair in '/:200' '/sources.html:200' '/mentions-legales.html:302' '/favicon.png:200' '/favicon.ico:302' '/assets/fond-bibliotheque-sombre.png:200' '/connexion.html:200' '/inscription.html:200' '/inscription.js:200' '/signup.html:302' '/atelier/:302' '/atelier/api/personnages:401' '/auth/status:401' '/atelier/api/admin/metrics:401' '/atelier/api/admin/directory:401' '/api/GetSupabaseKey:503' '/creer-personnage.html:503'; do
  route=${pair%:*};expected=${pair##*:}
  code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' "https://myrpgtable.fr$route")
  [[ "$code" == "$expected" ]]
  printf '%s %s\n' "$route" "$code"
done
node --env-file=/var/www/myrpgtable/shared/.env "$checker" "$target" "$backup/persistence-after.json" "$backup/persistence-before.json"
pm2 save > "$backup/service-save.log" 2>&1
changed=0
trap - ERR
printf 'Deployed: %s\nBackup and rollback: %s\n' "$target" "$backup"
