#!/usr/bin/env bash
# La versione più bassa di zr-auth che composer.json accetta in una minore: con `^0.12.4` la 0.12.4 per la 0.12, e un `^0.12`
# senza patch vale la 0.12.0. È quella che installa il giro «minima» della CI (ci.yml, «Dipendenze PHP»), che così non la
# riscrive: chi cambia il vincolo cambia anche ciò che quel giro prova. Il vincolo è fatto di `^0.<minore>`, anche con la patch,
# uno solo o più d'uno uniti da ` || `, la forma che guarda anche tests/Feature/PacchettoTest.php, e qui più stretta: un numero
# ha al più nove cifre, senza zeri davanti. Davanti a un'altra forma lo script si ferma, invece di indovinare. Legge soltanto:
# niente rete, e ciò che trova in composer.json non lo esegue.
#
# Uso: bash .github/minimo-di-zr-auth.sh <composer.json> <minore>
# Scrive la versione ed esce 0; esce 1 se composer.json non accetta quella minore, 2 se il vincolo o la minore non si leggono.
set -euo pipefail
# Nella localizzazione `C` una cifra è una delle dieci ASCII: in una come `en_US.UTF-8` `[0-9]` prende anche quelle di altre
# scritture (`٤`), che passerebbero la forma e poi farebbero uscire 2 il confronto più sotto, in silenzio.
export LC_ALL=C

composer="${1:-}"
minore="${2:-}"

# Un numero ha al più nove cifre: uno più lungo di quanto la shell sa confrontare farebbe uscire 2 il confronto più sotto, che
# dentro un `if` vale «falso» in silenzio, e passerebbe per il minimo una versione che non lo è.
numero='(0|[1-9][0-9]{0,8})'
pezzo='\^0\.'"$numero"'(\.'"$numero"')?'
forma_della_minore="^0\.${numero}\$"
forma_del_vincolo="^${pezzo}( \|\| ${pezzo})*\$"

if [ -z "$composer" ] || [[ ! "$minore" =~ $forma_della_minore ]]; then
    echo "uso: minimo-di-zr-auth.sh <composer.json> <minore, come 0.12>" >&2
    exit 2
fi

if ! vincolo=$(jq -er '.require["zeiras/zr-auth"] | strings' "$composer" 2>/dev/null); then
    echo "in ${composer} non si legge il vincolo di zeiras/zr-auth" >&2
    exit 2
fi

if [[ ! "$vincolo" =~ $forma_del_vincolo ]]; then
    echo "il vincolo «${vincolo}» non è fatto di ^0.<minore> uniti da ||" >&2
    exit 2
fi

# Di ogni pezzo del vincolo che parla di questa minore, la patch: senza, la prima. Se la minore c'è due volte vale la più bassa.
minima=''
IFS='|' read -r -a pezzi <<<"${vincolo// || /|}"
for uno in "${pezzi[@]}"; do
    versione="${uno#'^'}"
    case "$versione" in
        "$minore") patch=0 ;;
        "$minore".*) patch="${versione#"$minore".}" ;;
        *) continue ;;
    esac
    if [ -z "$minima" ] || [ "$patch" -lt "$minima" ]; then
        minima="$patch"
    fi
done

if [ -z "$minima" ]; then
    echo "${composer} non accetta zr-auth ${minore}: il vincolo è «${vincolo}»" >&2
    exit 1
fi

echo "${minore}.${minima}"
