#!/usr/bin/env bash
# Publish the game to https://technikweber.github.io/Tempo6/
#
# The source stays in this (private) repo; only the built game goes into the public blog
# repo, in the folder Tempo6/, the same way as the other browser projects. GitHub Pages
# serves it a minute or two after the push.
#
#   npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_REPO=https://github.com/TechnikWeber/TechnikWeber.github.io.git
SITE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/tempo6-deploy/site"

npm run build

if [ -d "$SITE_DIR/.git" ]; then
  git -C "$SITE_DIR" fetch -q origin
  git -C "$SITE_DIR" reset -q --hard origin/HEAD
else
  mkdir -p "$(dirname "$SITE_DIR")"
  git clone -q --depth 1 "$SITE_REPO" "$SITE_DIR"
fi

rm -rf "$SITE_DIR/Tempo6"
mkdir -p "$SITE_DIR/Tempo6"
cp -r dist/. "$SITE_DIR/Tempo6/"

cd "$SITE_DIR"
git add Tempo6
if git diff --cached --quiet; then
  echo "Nothing new to publish."
  exit 0
fi
# (the blog's own rule: commits there carry no co-author line)
git commit -q -m "Tempo6: neue Version"
git push -q
echo "Published: https://technikweber.github.io/Tempo6/ (live in a minute or two)"
