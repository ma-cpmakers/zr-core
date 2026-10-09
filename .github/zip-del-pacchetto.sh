#!/usr/bin/env bash
# Lo zip del tag — ciò che Composer dà a un frontend — porta solo ciò che serve a chi installa: il codice del pacchetto, il
# registro, le lingue, le copie del design system e il README. Non gli strumenti di questo repo (test, pagine di prova, script,
# CLAUDE.md): li tiene fuori `export-ignore` in .gitattributes. Un file nuovo alla radice o una cartella nuova vogliono la loro
# riga lì, oppure il loro posto nell'elenco qui sotto, se servono a chi installa. Gira nella radice del repo e lo lancia la CI:
# dice ogni file di troppo ed esce 1. Con un argomento guarda quell'albero invece di HEAD.
set -uo pipefail

albero="${1:-HEAD}"

if ! elenco=$(git archive "$albero" | tar -tf -); then
    echo "lo zip di ${albero} non si legge"
    exit 1
fi

file=$(grep -v '/$' <<<"$elenco")
if [ -z "$file" ]; then
    echo "lo zip di ${albero} è vuoto"
    exit 1
fi

# Ciò che serve a chi installa, e niente altro; e mai un test, nemmeno in una cartella ammessa.
ditroppo=$(grep -v -E '^(README\.md|composer\.json|package\.json|(src|routes|resources/(css|js|lingue|registro|zeiras))/.+)$' <<<"$file")
ditest=$(grep -E '\.test\.tsx?$' <<<"$file")

if [ -n "${ditroppo}${ditest}" ]; then
    echo "nello zip del pacchetto c'è ciò che non serve a chi installa:"
    printf '%s\n' "$ditroppo" "$ditest" | grep -v '^$' | sort -u
    exit 1
fi

echo "lo zip di ${albero}: $(wc -l <<<"$file") file, tutti del pacchetto"
