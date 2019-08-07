set -e				# fail on error

# Only run on builds for pushes to the master branch.
# if ! [ "$TRAVIS_EVENT_TYPE" = "push" -a "$TRAVIS_BRANCH" = "master" ]; then
    # exit 0
# fi

# Make sure we have access to secure Travis environment variables.
if ! [ "$TRAVIS_SECURE_ENV_VARS" = "true" ]; then
    echo 'deploy_nightly.sh: Build is a push to master, but no secure env vars.' >&2
    exit 1			# Something's wrong.
fi

git clone https://github.com/bryangingechen/lean-web-editor-dist.git
cd lean-web-editor-dist
git remote add deploy "https://$GITHUB_TOKEN@github.com/bryangingechen/lean-web-editor.git"
cd ..

git clone https://github.com/bryangingechen/bryangingechen.github.io.git
cd bryangingechen.github.io
git remote add deploy "https://$GITHUB_TOKEN@github.com/bryangingechen/bryangingechen.github.io.git"
cd ..

# After this point, we don't use any secrets in commands.
set -x				# echo commands

# push lean-web-editor-dist
cp dist/lib* lean-web-editor-dist
cd lean-web-editor-dist
git add -A
git diff-index --quiet HEAD || git commit --amend --no-edit
git push deploy -f --dry-run
cd ..

# push bryangingechen.github.io
cd bryangingechen.github.io/lean/lean-web-editor
git submodule update --remote
git add -A
git diff-index --quiet HEAD || git commit -m "lean-web-editor-dist: $(date)"
git push deploy --dry-run
cd ../../..
