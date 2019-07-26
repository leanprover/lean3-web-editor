#!/bin/sh
set -ex

out_dir=dist
mkdir -p $out_dir

base_url=https://bryangingechen.github.io/lean/lean-web-editor
lib_name=library # change to 'libcore' to download a bundle of the core libraries

for i in lean_js_js.js lean_js_wasm.js lean_js_wasm.wasm \
    $lib_name.zip $lib_name.info.json $lib_name.olean_map.json
do
    curl $base_url/$i -o $out_dir/$i
done
