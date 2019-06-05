# lean-web-editor

This repository contains the javascript code for my fork of the [Lean live editor](https://bryangingechen.github.io/lean/lean-web-editor). This branch is meant to be built with [a fork of `lean-client-js`](https://github.com/bryangingechen/lean-client-js/tree/cache); to do this, change the `lean-client-js-browser` entry in `package.json` [to point to a local path to that repository](https://docs.npmjs.com/files/package.json#local-paths).

## Running the development version

```
npm install
./fetch_lean_js.sh
./node_modules/.bin/webpack-dev-server
```

The `fetch_lean_js.sh` script fetches a precompiled javascript version as well as a `library.zip` file containing the olean files.

It is also possible to build your own Javascript / WebAssembly version of [the community fork of Lean 3](https://github.com/leanprover-community/lean). See the instructions [here](https://github.com/leanprover-community/lean/blob/master/doc/make/index.md#building-js--wasm-binaries-with-emscripten). Prebuilt versions are also included with the leanprover-community [lean-nightly releases](https://github.com/leanprover-community/lean-nightly/releases). Copy the files `lean_js_js.js`, `lean_js_wasm.js` and `lean_js_wasm.wasm` to the `dist/` directory. Note that if you choose to go this route, you will also have to recompile the .olean files in library.zip (see below).

## Deployment

```
npm install
./fetch_lean_js.sh
NODE_ENV=production ./node_modules/.bin/webpack
```

Then copy the `./dist` directory wherever you want.

## Creating a customized `library.zip`

If you want to include custom libraries, then you need to build a suitable `library.zip` file yourself.

1. Change `combined_lib/leanpkg.toml` to include the libraries you want. If necessary, edit `lean_version` to point to the version of Lean that corresponds to the version of Lean built with Emscripten above.
2. Run `./mk_library.py` to create `dist/library.zip` (requires Python 3.5 or greater). Type `./mk_library.py -h` for information about command-line options. This script will also generate a pair of `.json` files which are used by `lean-client-js-browser`:
  - `dist/library.info.json` contains github URL prefixes to the precise commits of the Lean packages contained in `library.zip` and is used for caching,
  - `dist/library.olean_map.json` is used to help resolve references to individual `.lean` files returned by the Lean server to their URLs on github.
