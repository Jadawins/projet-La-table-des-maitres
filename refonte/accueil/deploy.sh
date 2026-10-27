#!/bin/bash
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
bundle="/tmp/myrpgtable-accueil-$stamp.tar.gz"
target="/var/www/myrpgtable/maintenance/$stamp"
backup="/root/backups/myrpgtable-accueil-$stamp"
active="/etc/nginx/sites-enabled/myrpgtable.fr"
nginx -t
test -f "$bundle"
test -f "$active"
test ! -e "$target"
test ! -e "$backup"
mkdir -p /var/www/myrpgtable/maintenance /root/backups
mkdir "$target" "$backup"
cp -a "$active" "$backup/nginx.previous.conf"
sha256sum /var/www/myrpgtable/app/index.html /var/www/myrpgtable/app/home.html /var/www/myrpgtable/app/creer-personnage.html > "$backup/old-app.sha256"
tar -xzf "$bundle" -C "$target" --no-same-owner
chmod 755 "$target"
chmod 644 "$target"/*
sed "s|__MAINTENANCE_ROOT__|$target|g" "$target/nginx.conf" > "$backup/nginx.new.conf"
restore() {
    cp -a "$backup/nginx.previous.conf" "$active"
    nginx -t && systemctl reload nginx
}
cp "$backup/nginx.new.conf" "$active"
if ! nginx -t; then restore; exit 1; fi
if ! systemctl reload nginx; then restore; exit 1; fi
sleep 1
root_code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o "$backup/home-check.html" -w '%{http_code}' https://myrpgtable.fr/)
old_code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' https://myrpgtable.fr/creer-personnage.html)
api_code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' https://myrpgtable.fr/api/classes)
if [[ "$root_code" != 200 || "$old_code" != 503 || "$api_code" != 503 ]] || ! grep -q 'La Table du Maître fait peau neuve' "$backup/home-check.html"; then
    restore
    echo 'Vérification échouée, configuration précédente rétablie.'
    exit 1
fi
sha256sum -c "$backup/old-app.sha256"
printf 'Accueil: %s\nAncienne page: %s\nAPI publique: %s\nFichiers: %s\nRetour arrière: %s/nginx.previous.conf\n' "$root_code" "$old_code" "$api_code" "$target" "$backup"
