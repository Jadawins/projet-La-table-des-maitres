#!/bin/bash
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
release="/var/www/myrpgtable/refonte-access/20261027T132811Z"
target="$release/atelier"
backup="/root/backups/myrpgtable-sheet-tabs-$stamp"
stage="/var/www/myrpgtable/refonte-access/ui-$stamp"
grep -Fq "root $release/public;" /etc/nginx/sites-enabled/myrpgtable.fr
test "$(readlink -f "$target")" = "$target"
test ! -e "$backup"
test ! -e "$stage"
mkdir "$backup" "$stage"
tar -xzf "/tmp/myrpgtable-sheet-tabs-$stamp.tar.gz" -C "$stage" --no-same-owner
for file in app.js sheet-view.mjs style.css; do
    test -f "$target/$file"
    test -f "$stage/$file"
    cp -a "$target/$file" "$backup/$file"
done
cd "$stage"
sha256sum -c SHA256SUMS
for file in app.js sheet-view.mjs style.css; do
    install -m 644 "$stage/$file" "$target/$file.new"
    mv -f "$target/$file.new" "$target/$file"
done
cd "$target"
sha256sum -c "$stage/SHA256SUMS"
code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' https://myrpgtable.fr/atelier/)
if [[ "$code" != 302 ]]; then
    for file in app.js sheet-view.mjs style.css; do cp -a "$backup/$file" "$target/$file"; done
    echo 'Access check failed; previous UI restored.'
    exit 1
fi
printf 'Sheet UI updated without restarting authentication.\nBackup: %s\n' "$backup"
