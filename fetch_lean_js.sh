#!/bin/sh
set -ex

mkdir -p dist

base_url=https://leanprover.github.io/live/latest/

for i in lean_js_js.js lean_js_wasm.js lean_js_wasm.wasm library.zip; do
    curl $base_url/$i -o dist/$i
done