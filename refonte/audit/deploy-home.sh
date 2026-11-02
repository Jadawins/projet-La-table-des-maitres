#!/bin/bash
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
previous=/var/www/myrpgtable/refonte-access/20261102T075800Z
target="/var/www/myrpgtable/refonte-access/$stamp"
backup="/root/backups/myrpgtable-persistence-$stamp"
active=/etc/nginx/sites-enabled/myrpgtable.fr
archive="/tmp/myrpgtable-home-$stamp.tar.gz"
checker=/tmp/check-advancement-persistence.mjs
test -f "$archive"
test -f "$checker"
test -f /tmp/check-admin-accounts.mjs
test -f /tmp/check-group-persistence.mjs
test -f /tmp/check-combat-persistence.mjs
test -f /tmp/check-bestiary-persistence.mjs
test -f /tmp/check-attack-persistence.mjs
test -f /tmp/check-group-options-persistence.mjs
node --env-file=/var/www/myrpgtable/shared/.env --input-type=module <<'PREFLIGHT'
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
if(!key){console.error('Clé serveur Supabase absente. Aucun déploiement.');process.exit(2);}
try{
 const r=await fetch((process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL).replace(/\/$/,'')+'/auth/v1/admin/users?page=1&per_page=1',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error();
}catch{console.error('Accès administratif Supabase indisponible. Aucun déploiement.');process.exit(2);}
PREFLIGHT
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
for file in attack-rules.mjs combat-attacks.mjs bestiary-store.mjs combat-store.mjs group-store.mjs admin-store.mjs server.mjs start.mjs character-store.mjs rules-store.mjs import-rules.mjs; do node --check "$target/$file"; done
test ! -e "$target/atelier/catalogue.json"
node --env-file=/var/www/myrpgtable/shared/.env "$checker" "$target" "$backup/persistence-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-admin-accounts.mjs "$target" "$backup/accounts-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-group-persistence.mjs "$target" "$backup/groups-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-combat-persistence.mjs "$target" "$backup/combat-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-bestiary-persistence.mjs "$target" "$backup/bestiary-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-attack-persistence.mjs "$target" "$backup/attacks-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-group-options-persistence.mjs "$target" "$backup/group-options-before.json"
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
# Reload returns before replacement workers necessarily accept connections.
# Wait for the new public asset before testing newly introduced routes.
asset_ready=0
for n in $(seq 1 20); do
  code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 --max-time 5 -s -o /dev/null -w '%{http_code}' https://myrpgtable.fr/home.css || true)
  if [[ "$code" == 200 ]]; then asset_ready=1; break; fi
  sleep 1
done
[[ "$asset_ready" == 1 ]]
for pair in '/:200' '/home.css:200' '/atelier/home-content.mjs:302' '/atelier/home.css:302' '/favicon.png:200' '/favicon.ico:302' '/assets/fond-bibliotheque-sombre.png:200' '/connexion.html:200' '/inscription.html:200' '/inscription.js:200' '/signup.html:302' '/atelier/:302' '/atelier/api/personnages:401' '/atelier/api/groupes:401' '/atelier/api/groupes/not-a-group/combat:401' '/atelier/combat-view.mjs:302' '/atelier/api/groupes/not-a-group/bestiaire:401' '/atelier/bestiary-view.mjs:302' '/atelier/api/groupes/not-a-group/combat/attaques:401' '/atelier/attack-view.mjs:302' '/atelier/group-view.mjs:302' '/auth/status:401' '/atelier/api/admin/metrics:401' '/atelier/api/admin/directory:401' '/api/GetSupabaseKey:503' '/creer-personnage.html:503'; do
  route=${pair%:*};expected=${pair##*:}
  code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' "https://myrpgtable.fr$route")
  [[ "$code" == "$expected" ]]
  printf '%s %s\n' "$route" "$code"
done
node --env-file=/var/www/myrpgtable/shared/.env "$checker" "$target" "$backup/persistence-after.json" "$backup/persistence-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-admin-accounts.mjs "$target" "$backup/accounts-after.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-group-persistence.mjs "$target" "$backup/groups-after.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-combat-persistence.mjs "$target" "$backup/combat-after.json" "$backup/combat-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-bestiary-persistence.mjs "$target" "$backup/bestiary-after.json" "$backup/bestiary-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-attack-persistence.mjs "$target" "$backup/attacks-after.json" "$backup/attacks-before.json"
node --env-file=/var/www/myrpgtable/shared/.env /tmp/check-group-options-persistence.mjs "$target" "$backup/group-options-after.json" "$backup/group-options-before.json"
pm2 save > "$backup/service-save.log" 2>&1
changed=0
trap - ERR
printf 'Deployed: %s\nBackup and rollback: %s\n' "$target" "$backup"
