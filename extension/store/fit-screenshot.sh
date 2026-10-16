#!/bin/sh
# Turns any screen capture into a Web Store screenshot: 1280x800, 24-bit PNG without alpha.
# The capture is scaled to fit, centred, and padded with the report paper colour.
# Usage: ./fit-screenshot.sh capture.png [more.png ...]  ->  capture-1280x800.png
set -e
for src in "$@"; do
  out="${src%.*}-1280x800.png"
  tmp="$(mktemp -d)"
  w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/ {print $2}')
  h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/ {print $2}')
  # largest size that fits 1280x800 while keeping the ratio
  if [ $((w * 800)) -gt $((h * 1280)) ]; then nw=1280; nh=$((h * 1280 / w)); else nh=800; nw=$((w * 800 / h)); fi
  # going through JPEG drops the alpha channel that macOS captures carry
  sips -s format jpeg -s formatOptions best "$src" --out "$tmp/a.jpg" >/dev/null
  sips -z "$nh" "$nw" "$tmp/a.jpg" >/dev/null
  sips -p 800 1280 --padColor F4F5F7 "$tmp/a.jpg" >/dev/null 2>&1
  sips -s format png "$tmp/a.jpg" --out "$out" >/dev/null
  rm -rf "$tmp"
  echo "$out"
done
