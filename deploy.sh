set -e # fail on error

# Make sure we have access to secure Travis environment variables.
if ! [ "$TRAVIS_SECURE_ENV_VARS" = "true" ]; then
    echo 'deploy_nightly.sh: Build is a push to master, but no secure env vars.' >&2
    exit 1 # Something's wrong.
fi

git clone https://github.com/bryangingechen/lean-web-editor-dist.git
cd lean-web-editor-dist
git remote add deploy "https://$GITHUB_TOKEN@github.com/bryangingechen/lean-web-editor-dist.git"
rm -f *.worker.js
cd ..

git clone https://github.com/bryangingechen/bryangingechen.github.io.git
cd bryangingechen.github.io
git remote add deploy "https://$GITHUB_TOKEN@github.com/bryangingechen/bryangingechen.github.io.git"
cd ..

git clone https://github.com/leanprover-community/leanprover-community.github.io.git
cd leanprover-community.github.io
git remote add deploy "https://$GITHUB_TOKEN@github.com/leanprover-community/leanprover-community.github.io.git"
rm -f lean-web-editor/*.worker.js
cd ..

# After this point, we don't use any secrets in commands.
set -x # echo commands

LATEST_BROWSER_LEAN_URL=https://github.com/leanprover-community/lean/releases/download/v$ELAN_OVERRIDE/lean-$ELAN_OVERRIDE--browser.zip

rm -f dist/*.worker.js
npm install
NODE_ENV=production ./node_modules/.bin/webpack
cd dist
curl -sL $LATEST_BROWSER_LEAN_URL --output leanbrowser.zip
unzip -q leanbrowser.zip
rm leanbrowser.zip
mv build/shell/* .
rm -rf build/
cd ..

# push lean-web-editor-dist
cp -a dist/. lean-web-editor-dist
cd lean-web-editor-dist
git add -A
git diff-index HEAD
git diff-index --quiet HEAD || { git commit --amend --no-edit && git push deploy -f; }
cd ..

# push bryangingechen.github.io
cd bryangingechen.github.io
git submodule update --init --remote
git add -A
git diff-index HEAD
git diff-index --quiet HEAD || { git commit -m "lean-web-editor-dist: $(date)" && git push deploy; }
cd ..

# push leanprover-community.github.io
COMMUNITY=TRUE NODE_ENV=production ./node_modules/.bin/webpack
cd leanprover-community.github.io
git pull
cp -a ../dist/. lean-web-editor
rm -f lean-web-editor/lib*
rm -f lean-web-editor/lean_js_*
git add -A
git diff-index HEAD
git diff-index --quiet HEAD || { git commit -m "lean-web-editor: $(date)" && git push deploy; }
