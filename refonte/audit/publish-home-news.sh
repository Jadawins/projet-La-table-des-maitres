#!/bin/bash
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
release=/var/www/myrpgtable/refonte-access/20261103T063025Z
stage="/tmp/myrpgtable-home-news-$stamp"
backup="/root/backups/myrpgtable-persistence-home-news-$stamp"
test ! -e "$stage"
test ! -e "$backup"
grep -Fq "root $release/public;" /etc/nginx/sites-enabled/myrpgtable.fr
pm2 describe myrpgtable-refonte | grep -Fq "$release/start.mjs"
before_pid=$(pm2 pid myrpgtable-refonte)
[[ "$before_pid" =~ ^[1-9][0-9]*$ ]]
mkdir "$stage"
tar -xzf "/tmp/myrpgtable-home-news-$stamp.tar.gz" -C "$stage" --no-same-owner
node --input-type=module - "$release" "$stage" <<'VERIFY'
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [release,stage]=process.argv.slice(2),proof=JSON.parse(fs.readFileSync(stage+'/manifest.json','utf8')),sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(proof.status,'passed');assert.equal(proof.baseRelease,release.split('/').at(-1));assert.equal(proof.failed,0);assert.equal(proof.skipped,0);assert.deepEqual(proof.files.map(f=>f.target).sort(),['atelier/home-content.mjs','public/index.html']);
for(const f of proof.files){assert.equal(sha(fs.readFileSync(stage+'/'+f.target)),f.sha256);assert.equal(sha(fs.readFileSync(release+'/'+f.target,'utf8').replaceAll('\r\n','\n')),f.baselineNormalizedSha256,'Unexpected live content: '+f.target);}
VERIFY
node --check "$stage/atelier/home-content.mjs"
mkdir -m 700 "$backup"
tar -czf "$backup/home-previous.tar.gz" -C "$release" public/index.html atelier/home-content.mjs
node --env-file=/var/www/myrpgtable/shared/.env "$release/backup-db.mjs" "$backup/database.ejsonl.gz"
gzip -t "$backup/database.ejsonl.gz"
gzip -t "$backup/home-previous.tar.gz"
cp "$stage/manifest.json" "$backup/manifest.json"
cat > "$backup/rollback.sh" <<EOF
#!/bin/bash
set -euo pipefail
tar -xzf '$backup/home-previous.tar.gz' -C '$release' --no-same-owner
EOF
chmod 700 "$backup/rollback.sh"
changed=0
rollback(){ rc=$?; trap - ERR; if [[ "$changed" == 1 ]]; then bash "$backup/rollback.sh"; fi; exit "$rc"; }
trap rollback ERR
changed=1
for file in public/index.html atelier/home-content.mjs; do
  install -m 644 "$stage/$file" "$release/$file.home-news-new"
  mv -f "$release/$file.home-news-new" "$release/$file"
  cmp "$stage/$file" "$release/$file"
done
code=$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o "$backup/public-after.html" -w '%{http_code}' https://myrpgtable.fr/)
[[ "$code" == 200 ]]
for text in 'MESSAGES DU MJ' 'INVENTAIRE' 'SORTS EN COMBAT' '3 novembre 2026'; do grep -Fq "$text" "$backup/public-after.html"; done
[[ "$(curl --resolve myrpgtable.fr:443:127.0.0.1 -sS -o /dev/null -w '%{http_code}' https://myrpgtable.fr/atelier/home-content.mjs)" == 302 ]]
if grep -Eiq 'administrat' "$backup/public-after.html"; then
  echo 'Private administration must not be promoted on the public home.'
  false
fi
[[ "$(pm2 pid myrpgtable-refonte)" == "$before_pid" ]]
printf '%s\n' "$before_pid" > "$backup/unchanged-service-pid.txt"
changed=0
trap - ERR
printf 'Published home news: %s\nBackup: %s\n' "$stamp" "$backup"
