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

# Get lean_version from mathlib master:
export LATEST_BROWSER_LEAN=$(curl -s -N https://raw.githubusercontent.com/leanprover-community/mathlib/master/leanpkg.toml | grep -m1 lean_version | cut -d'"' -f2)
# Get lean_version from leanpkg.toml in this repo:
# $(grep -m1 version combined_lib/leanpkg.toml | cut -d'"' -f2)
# Get lean_version from latest released Lean
# $(curl -s -N https://$GITHUB_TOKEN@api.github.com/repos/leanprover-community/lean/releases | grep -m1 "browser_download_url.*browser.zip" | cut -d / -f 8 | cut -d v -f 2)

# After this point, we don't use any secrets in commands.
set -x				# echo commands

elan toolchain install leanprover-community/lean:$LATEST_BROWSER_LEAN

set +x
