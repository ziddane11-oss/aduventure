#!/usr/bin/env bash
# itch.io 업로드용 zip을 만든다. 사용법: tools/build-itch.sh [공유 주소]
#   공유 주소를 주면 엔딩의 공유 문구가 그 주소(예: https://아이디.itch.io/returned-letter)를 쓴다.
#   주지 않으면 GitHub Pages의 letter.html을 쓴다.
# 결과: dist/itch/aduventure-returned-letter-<빌드>.zip
#   index.html  — itch.io가 iframe으로 여는 시작 파일. game.html#returned-letter로 넘긴다.
#   game.html   — 게임 본체(index.html 사본). 「본편으로 돌아가기」를 누르면 본편이 이어진다.
#   art/        — 초상 그림
set -euo pipefail
cd "$(dirname "$0")/.."
SHARE_URL="${1:-}"
BUILD=$(grep -o 'const BUILD = "[^"]*"' index.html | cut -d'"' -f2)
[ -n "$BUILD" ] || { echo "BUILD 태그를 찾지 못했습니다" >&2; exit 1; }
STAGE=dist/itch/stage
OUT="dist/itch/aduventure-returned-letter-$BUILD.zip"
rm -rf "$STAGE" "$OUT"; mkdir -p "$STAGE"
cp -r art "$STAGE/art"
if [ -n "$SHARE_URL" ]; then
  case "$SHARE_URL" in https://*) ;; *) echo "공유 주소는 https://로 시작해야 합니다" >&2; exit 1;; esac
  # 첫 <script> 앞에 공유 주소를 주입한다(따옴표·꺾쇠는 거부).
  case "$SHARE_URL" in *[\"\'\<\>\\]*) echo "공유 주소에 쓸 수 없는 문자가 있습니다" >&2; exit 1;; esac
  awk -v url="$SHARE_URL" '!done && /<script/ { print "<script>window.ADU_SHARE_URL=\"" url "\";</script>"; done=1 } { print }' index.html > "$STAGE/game.html"
else
  cp index.html "$STAGE/game.html"
fi
cat > "$STAGE/index.html" <<'HTML'
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>반송된 편지 · The Returned Letter</title>
<script>location.replace("game.html#returned-letter");</script>
<style>body{background:#171310;color:#e9e0cf;font-family:serif;padding:24px 16px}a{color:#dcc5a0}</style>
</head>
<body><p><a href="game.html#returned-letter">반송된 편지 열기 · Open The Returned Letter</a></p></body>
</html>
HTML
(cd "$STAGE" && python3 -m zipfile -c "../$(basename "$OUT")" index.html game.html art)
rm -rf "$STAGE"
echo "$OUT"
python3 -m zipfile -l "$OUT"
