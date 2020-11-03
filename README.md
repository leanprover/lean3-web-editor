# lean-web-editor

This repository contains the code for the leanprover-community fork of the [Lean live editor](https://leanprover-community.github.io/lean-web-editor).

You will need to install [nodejs](https://nodejs.org/en/) (which should include npm) to try this out locally.

## Running the development version

```
npm install
./fetch_lean_js.sh
./node_modules/.bin/webpack-dev-server
```

(You only need to run `npm install` and `./fetch_lean_js.sh` once after you download this repository.)

The `fetch_lean_js.sh` script fetches a precompiled javascript version as well as a `library.zip` file containing the olean files for [`mathlib`](https://github.com/leanprover-community/mathlib).

It is also possible to build your own Javascript / WebAssembly version of [the community fork of Lean 3](https://github.com/leanprover-community/lean). See the instructions [here](https://github.com/leanprover-community/lean/blob/master/doc/make/index.md#building-js--wasm-binaries-with-emscripten). Prebuilt versions are also included with the leanprover-community [lean releases](https://github.com/leanprover-community/lean/releases). Copy the files `lean_js_js.js`, `lean_js_wasm.js` and `lean_js_wasm.wasm` to the `dist/` directory. Note that if you choose to go this route, you will also have to recompile the `.olean` files in `library.zip` (see below).

## Deployment

```
npm install
./fetch_lean_js.sh
NODE_ENV=production ./node_modules/.bin/webpack
```

(You only need to run `npm install` and `./fetch_lean_js.sh` if you haven't already done so above.)

Then copy the `./dist` directory wherever you want.

## Creating a customized `library.zip`

If you want to include custom libraries, then you need to build a suitable `library.zip` file yourself.

The main tool provided by this repository is a Python script, `mk_library.py`, which requires Python 3.7 or greater. Type `./mk_library.py -h` to see all command-line options.

By default, the script will run `leanpkg build` in the `/combined_lib/` subdirectory, or a Lean package that you specify with `-i`, thus generating up-to-date `.olean` files. You may see "Lean version mismatch" warnings; these should be safe to ignore. (The `-c` command-line flag skips this step if you only want bundle Lean's core library files.) The script then copies all `.olean` files that it can find in the `leanpkg.path` into a ZIP bundle (placed at `dist/library.zip` by default, can be specified with `-o`). This script will also generate a pair of `.json` files which are used by `lean-client-js-browser`:
    - `dist/library.info.json` contains GitHub URL prefixes to the precise commits of the Lean packages contained in `library.zip` and is used for caching,
    - `dist/library.olean_map.json` is used to help resolve references to individual `.lean` files returned by the Lean server to their URLs on GitHub.

Here are step-by-step instructions for the most common use-cases:

1. Install Lean 3. If you plan to use the prebuilt JS/WASM versions of Lean downloaded from the [leanprover-community/lean](https://github.com/leanprover-community/lean/releases) site, i.e. if you are **not** compiling Lean with Emscripten yourself, I recommend using [`elan`](https://github.com/kha/elan) to install the latest community version using the command
`elan toolchain install leanprover-community/lean:3.15.0` (replace `3.15.0` with whatever the latest released version is). If you then check `elan show`, you should see a new toolchain with the name: `leanprover-community/lean:3.15.0`. CAVEAT: if you want to bundle mathlib, make sure the version of Lean you install is compatible with the version of mathlib you want to use.
   If you are compiling Lean yourself, use `elan toolchain link` to set up an `elan` toolchain that points to the location of Lean on your computer. Then below, when you edit `leanpkg.toml`, ensure that `lean_version` points to this toolchain.
2. To make a ZIP bundle containing only Lean's core libraries, run `./mk_library.py -c`. You can set the output ZIP file location with `./mk_library.py -c -o /path/to/output.zip`.
3. To make a ZIP bundle containing all of the `.olean` files in one or multiple Lean packages:
    - Edit `combined_lib/leanpkg.toml`:
        - `lean_version` needs to point to the same version of Lean as the Emscripten build of Lean you plan to use. If you've installed the community version of Lean with `elan` as above, then you'll want that line to read `lean_version = "leanprover-community/lean:3.15.0"`.
        - Add the libraries you want to bundle to the `[dependencies]` section. You can use either `leanpkg add` or enter them manually with the format `mathlib = {git = "https://github.com/leanprover-community/mathlib", rev = "0c627fb3535d14955b2c2a24805b7cf473b4202f"}` (for dependencies retrievable using git) or `mathlib = {path = "/path/to/mathlib/"}` (for local dependencies).
        - In this use-case, it's important that you **don't** add a line with the `path` option to `leanpkg.toml`. Note that technically, such Lean packages are deprecated and `leanpkg` will emit a warning. Nonetheless, doing things this way causes `leanpkg build` to build all the Lean files in the packages you include, instead of just the ones depended on by the files in `/src`.
    - Run `./mk_library.py`. You can set the output ZIP file location with `./mk_library.py -o /path/to/output.zip`.
4. To make a ZIP bundle from a single Lean package (containing only the `.olean` files needed for the files in its `src/` directory):
    - To make a new Lean package, use `leanproject new` following the instructions [here](https://leanprover-community.github.io/install/project.html).
    - If you have an existing Lean package, you might want to make a new copy of it since otherwise you'll have to recompile when you work on it again.
    - Edit `lean_version` in the package's `leanpkg.toml`. It needs to point to the same version of Lean as the Emscripten build of Lean you plan to use. If you installed the latest community Lean with `elan` as above, then that line should read `lean_version = "leanprover-community/lean:3.15.0"`.
    - Delete `_target/` in your Lean package directory if it already exists and run `leanpkg configure` to wipe all `.olean` files in the dependencies. This step is necessary since the script in the next step will copy all `.olean` files that it can find after rebuilding.
    - Run `./mk_library.py -i /path/to/your_lean_package`. You can set the output ZIP file location with `./mk_library.py -i /path/to/your_lean_package -o /path/to/output.zip`.
