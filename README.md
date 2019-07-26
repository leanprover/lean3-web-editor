# lean-web-editor

This repository contains the javascript code for my fork of the [Lean live editor](https://bryangingechen.github.io/lean/lean-web-editor). This branch uses [a fork of `lean-client-js`](https://github.com/bryangingechen/lean-client-js/tree/cache) (published as `@bryangingechen/lean-client-js` on npm).

## Running the development version

```
npm install
./fetch_lean_js.sh
./node_modules/.bin/webpack-dev-server
```

The `fetch_lean_js.sh` script fetches a precompiled javascript version as well as a `library.zip` file containing the olean files for [`mathlib`](https://github.com/leanprover-community/mathlib), [`super`](https://github.com/leanprover/super), and [`mini_crush`](https://github.com/leanprover/mini_crush).

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

1. Install Lean 3. If you plan to use the prebuilt JS/WASM versions of Lean downloaded from the [leanprover-community/lean-nightly](https://github.com/leanprover-community/lean-nightly/releases) site, i.e. if you are not compiling Lean with Emscripten yourself, I recommend using [`elan`](https://github.com/kha/elan) to install the latest community version using the command
`elan toolchain install leanprover-community/lean:nightly`. If you then check `elan show`, you should see a new toolchain with the name: `leanprover-community-lean-nightly`.
2. To make a ZIP bundle of a selection of Lean packages, edit `combined_lib/leanpkg.toml`:
    - `lean_version` needs to point to the same version of Lean as the Emscripten build of Lean you plan to use. If you've installed the community nightly with `elan` as above, then you'll want that line to read `lean_version = "leanprover-community-lean-nightly"`.
    - Add the libraries you want to bundle to the `[dependencies]` section. You can use either `leanpkg add` or enter them manually with the format `mathlib = {git = "https://github.com/leanprover/mathlib", rev = "0c627fb3535d14955b2c2a24805b7cf473b4202f"}` (for dependencies retrievable using git) or `mathlib = {path = "/path/to/mathlib/"}` (for local dependencies).
3. To make a ZIP bundle from a single Lean package (containing only the olean files needed for the files in its `src/` directory):
    - To make a new Lean package, use `leanpkg new` following the instructions [here](https://github.com/leanprover-community/mathlib/blob/master/docs/install/project.md).
    - If you have an existing Lean package, make a new copy of it since otherwise you'll have to recompile when you want to work on it again
    - Change `lean_version` in `leanpkg.toml` to the same version as the Emscripten build of Lean. If you installed the community nightly with `elan` as above, then that line should read `lean_version = "leanprover-community-lean-nigthly"`.
    - Delete `_target/` and run `leanpkg configure` to wipe all olean files in the dependencies
4. If you followed step 2 (to make a bundle with several packages), run `./mk_library.py` (requires Python 3.7 or greater). If you followed step 3 (to make a bundle for a single package), run `./mk_library.py -i /path/to/your_lean_package`. This command will build the relevant olean files and then create a ZIP bundle (placed at `dist/library.zip` by default). Type `./mk_library.py -h` for information about command-line options. You may see "Lean version mismatch" warnings; these should be safe to ignore. This script will also generate a pair of `.json` files which are used by `lean-client-js-browser`:
    - `dist/library.info.json` contains github URL prefixes to the precise commits of the Lean packages contained in `library.zip` and is used for caching,
    - `dist/library.olean_map.json` is used to help resolve references to individual `.lean` files returned by the Lean server to their URLs on github.
