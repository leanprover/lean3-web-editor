set -e # fail on error
set -x
# Get lean_version from mathlib master:
export LATEST_BROWSER_LEAN=$(curl -s -N https://raw.githubusercontent.com/leanprover-community/mathlib/master/leanpkg.toml | grep -m1 lean_version | cut -d'"' -f2 | cut -d':' -f2)

elan self update
elan toolchain install leanprover-community/lean:$LATEST_BROWSER_LEAN

set +x
