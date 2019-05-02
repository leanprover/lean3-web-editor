# lean-web-editor

This repository contains the javascript code for the [lean live editor](https://leanprover.github.io/live/).

## Running the development version

```
npm install
./fetch_lean_js.sh
./node_modules/.bin/webpack-dev-server
```

The `fetch_lean_js.sh` script fetches a precompiled javascript version as well as a `library.zip` file containing the olean files.

## Deployment

```
npm install
./fetch_lean_js.sh
NODE_ENV=production ./node_modules/.bin/webpack
```

Then copy the `./dist` directory wherever you want.

## Creating a customized `library.zip`

If you want to include custom libraries, then you need to build a suitable `library.zip` file yourself.

1. Change `combined_lib/leanpkg.toml` to include the libraries you want.
2. Run `./mk_library.py` to create `dist/library.zip`.  Make sure you run the same Lean version locally as the javascript version you target.