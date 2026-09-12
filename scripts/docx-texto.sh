#!/usr/bin/env bash
# Extrae el texto de un .docx como párrafos separados por línea en blanco.
# Uso: scripts/docx-texto.sh "ruta/al/archivo.docx"
set -euo pipefail
origen="$1"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
unzip -o -q "$origen" -d "$tmp"
sed -e 's|</w:p>|\n|g' "$tmp/word/document.xml" \
  | sed -e 's|<[^>]*>||g' \
  | sed -e 's|&amp;|\&|g; s|&lt;|<|g; s|&gt;|>|g; s|&quot;|"|g; s|&apos;|'"'"'|g' \
  | sed -e 's/[[:space:]]\+$//' \
  | grep -v '^[[:space:]]*$' \
  | sed -e 's/$/\n/'
