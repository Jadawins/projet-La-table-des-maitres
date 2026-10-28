$ErrorActionPreference = 'Stop'
# Consultation uniquement : aucune commande d'écriture MongoDB et aucun secret exporté.
$remoteRead = @'
cd /var/www/myrpgtable/api-server || exit 1
node <<'NODE'
require('dotenv').config({path:'/var/www/myrpgtable/shared/.env',quiet:true});
const script = `try {
 const d = new Mongo(process.env.MONGO_URI).getDB('myrpgtable');
 const collections = ['classes','sous_classes','especes','backgrounds','sorts','dons','competences','armures','armes','outils','armes_bottes'];
 const snapshot = {source:'MongoDB myrpgtable',date:new Date().toISOString(),collections:{}};
 for(const name of collections) snapshot.collections[name] = d.getCollection(name).find({},{_id:0}).toArray();
 snapshot.collections.formes_animales = d.getCollection('monstres').find({type:/b[eê]te|beast|[eé]l[eé]mentaire|elemental/i},{_id:0}).toArray();
 print(JSON.stringify(snapshot));
} catch(e) {print(JSON.stringify({erreur:e.codeName||e.name}));quit(1);}`;
const r = require('child_process').spawnSync('mongosh',['--nodb','--quiet','--eval',script],{env:process.env,encoding:'utf8',timeout:30000,maxBuffer:10000000});
process.stdout.write(r.stdout||'');process.exitCode = r.status===0?0:1;
NODE
'@
$encodedRemote = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteRead.Replace("`r",'')))
if (-not $env:MYRPGTABLE_SSH) { throw 'Définir MYRPGTABLE_SSH (ex. utilisateur@hote)' }
$json = ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 $env:MYRPGTABLE_SSH "printf %s $encodedRemote | base64 -d | sh"
if ($LASTEXITCODE -ne 0) { throw 'Lecture des règles impossible' }
$text = $json -join "`n"
$snapshot = $text | ConvertFrom-Json
if ($snapshot.collections.classes.Count -ne 12 -or $snapshot.collections.sorts.Count -lt 1) { throw 'Extrait incomplet' }
[IO.Directory]::CreateDirectory((Join-Path $PSScriptRoot 'data')) | Out-Null
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'data/rules-mongodb.json'), $text)
$snapshot.collections.PSObject.Properties | ForEach-Object { [pscustomobject]@{Collection=$_.Name;Nombre=$_.Value.Count} } | Format-Table -AutoSize
