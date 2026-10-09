#!/usr/bin/env bash
# Lo zip del tag — ciò che Composer dà a un frontend — porta solo ciò che serve a chi installa: il codice del pacchetto, il
# registro, le lingue, le copie del design system e il README. Non gli strumenti di questo repo (test, pagine di prova, script,
# CLAUDE.md): li tiene fuori `export-ignore` in .gitattributes. Un file nuovo alla radice o una cartella nuova vogliono la loro
# riga lì, oppure il loro posto nell'elenco qui sotto, se servono a chi installa. Gira nella radice del repo e lo lancia la CI:
# dice ogni file di troppo e ogni file che manca, ed esce 1. Con un argomento guarda quell'albero invece di HEAD.
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
regola_degli_ammessi='^(README\.md|composer\.json|package\.json|(src|routes|resources/(css|js|lingue|registro|zeiras))/.+)$'
regola_dei_test='\.test\.tsx?$'
ditroppo=$(grep -v -E "$regola_degli_ammessi" <<<"$file")
ditest=$(grep -E "$regola_dei_test" <<<"$file")

if [ -n "${ditroppo}${ditest}" ]; then
    echo "nello zip del pacchetto c'è ciò che non serve a chi installa:"
    printf '%s\n' "$ditroppo" "$ditest" | grep -v '^$' | sort -u
    exit 1
fi

# E niente di meno: ogni file di quell'albero che serve a chi installa è nello zip. Una riga di .gitattributes troppo larga
# (`*.d.ts export-ignore`) ne toglierebbe uno senza che nessun test lo veda: i test leggono il repo, non lo zip.
if ! albero_intero=$(git -c core.quotePath=false ls-tree -r --name-only "$albero"); then
    echo "l'albero di ${albero} non si legge"
    exit 1
fi

mancano=$(LC_ALL=C comm -23 <(grep -E "$regola_degli_ammessi" <<<"$albero_intero" | grep -v -E "$regola_dei_test" | LC_ALL=C sort) <(LC_ALL=C sort <<<"$file"))
if [ -n "$mancano" ]; then
    echo "nello zip del pacchetto manca ciò che serve a chi installa:"
    printf '%s\n' "$mancano"
    exit 1
fi

echo "lo zip di ${albero}: $(wc -l <<<"$file") file, tutti del pacchetto e nessuno che manca"
