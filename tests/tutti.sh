#!/bin/sh
# Tutti i test uno dopo l'altro, con il riepilogo finale.
# Uso:  sh tests/tutti.sh
# Senza rete: PHASER_PATH=/percorso/phaser.min.js MATTER_PATH=/percorso/matter.min.js sh tests/tutti.sh
# (si scaricano una volta con  npm pack phaser@3.70.0 matter-js@0.19.0)
cd "$(dirname "$0")/.." || exit 1
ok=0; ko=0; falliti=""
for f in tests/*.js; do
  n=$(basename "$f" .js)
  inizio=$(date +%s)
  if node "$f" > "/tmp/scs-test-$n.log" 2>&1; then
    ok=$((ok + 1)); esito="ok"
  else
    ko=$((ko + 1)); esito="FALLITO (log: /tmp/scs-test-$n.log)"; falliti="$falliti $n"
  fi
  echo "$n: $esito, $(( $(date +%s) - inizio )) s"
done
echo
echo "Superati: $ok, falliti: $ko$falliti"
[ "$ko" -eq 0 ]
