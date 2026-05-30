#!/usr/bin/env bash
# =============================================================================
# FinFlow — one-shot deploy
#   • Backend : commit + push to `main`  → Render auto-deploys the LIVE service.
#   • Frontend: EAS build (iOS + Android, production) + auto-submit to
#               App Store (TestFlight) and Google Play.
#
# USAGE
#   ./deploy.sh ["commit message"]                  # both platforms (default)
#   PLATFORM=ios     ./deploy.sh ["commit message"] # iOS only  → App Store
#   PLATFORM=android ./deploy.sh ["commit message"] # Android only → Play Store
#   CI=1 ./deploy.sh                                 # non-interactive (EXPO_TOKEN + creds)
#
# ONE-TIME PREREQUISITES (read this before first run)
#   1. Accounts:
#        - Expo (free)
#        - Apple Developer Program  ($99/yr)   ← required for App Store/TestFlight
#        - Google Play Console      ($25 once) ← required for Play Store
#   2. Expo auth: `npx eas login` once  (or `export EXPO_TOKEN=...` for CI).
#   3. Store submit credentials:
#        Android: download a Google Play service-account JSON and save it as
#                 frontend/play-service-account.json  (gitignored).
#                 Referenced by eas.json → submit.production.android.
#        iOS:     first `eas submit -p ios` run will prompt for your Apple ID /
#                 App Store Connect API key and store it on EAS for reuse.
#                 (The app must exist as a record in App Store Connect.)
#   4. Play Store: the very first release of a brand-new app usually must be
#      uploaded manually once in the Play Console; after that this script works.
#   5. Tools: Node 22, git. (eas-cli is run via npx automatically.)
#
# Tip: set RENDER_DEPLOY_HOOK_URL to force a backend redeploy even with no code
#      change (Render Dashboard → service → Settings → Deploy Hook).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
BRANCH="main"
MSG="${1:-deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)}"
PLATFORM="${PLATFORM:-all}"   # ios | android | all
EAS_FLAGS=""
[ "${CI:-0}" = "1" ] && EAS_FLAGS="--non-interactive"

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
die()  { printf "\n\033[1;31m✖ %s\033[0m\n" "$1" >&2; exit 1; }

command -v git >/dev/null || die "git not found."
case "$PLATFORM" in ios|android|all) ;; *) die "PLATFORM must be: ios | android | all (got '$PLATFORM')";; esac
cd "$ROOT"

# Use the repo's pinned Node 22 if nvm is available.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null 2>&1 || true
fi
echo "Node: $(node -v 2>/dev/null || echo '??')"

# ----------------------------------------------------------------------------
# 1) BACKEND — commit any changes and push main; Render auto-deploys.
# ----------------------------------------------------------------------------
step "Backend → commit & push to '$BRANCH' (Render auto-deploys the live API)"
CUR="$(git rev-parse --abbrev-ref HEAD)"
[ "$CUR" = "$BRANCH" ] || die "You are on '$CUR'. Switch to '$BRANCH' first (git checkout $BRANCH)."

git add -A
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
fi
git push origin "$BRANCH"

if [ -n "${RENDER_DEPLOY_HOOK_URL:-}" ]; then
  step "Triggering Render deploy hook"
  curl -fsS "$RENDER_DEPLOY_HOOK_URL" >/dev/null && echo "Render deploy triggered."
fi

# ----------------------------------------------------------------------------
# 2) FRONTEND — build BOTH platforms (production) and submit to BOTH stores.
#    --auto-submit uploads each build to its store right after it finishes.
# ----------------------------------------------------------------------------
cd "$FRONTEND"

# Fail early with a clear message if not authenticated.
npx eas whoami >/dev/null 2>&1 || die "Not logged in to EAS. Run: cd frontend && npx eas login   (or export EXPO_TOKEN)."

# Android submit needs a Play Console account + service-account key. Warn early
# so an iOS-ready user isn't surprised by an Android failure.
if [ "$PLATFORM" != "ios" ] && [ ! -f "$FRONTEND/play-service-account.json" ]; then
  echo "⚠️  PLATFORM=$PLATFORM but frontend/play-service-account.json is missing."
  echo "    Android submit will fail until you have a Google Play Console account"
  echo "    + service-account JSON. To ship iOS only for now, run: PLATFORM=ios ./deploy.sh"
fi

step "Frontend → EAS build ($PLATFORM, production) + auto-submit to store(s)"
# shellcheck disable=SC2086
npx eas build --platform "$PLATFORM" --profile production --auto-submit $EAS_FLAGS

# ----------------------------------------------------------------------------
# 3) (optional) OTA update for users already on a matching build.
#    Uncomment if you also want to push JS-only updates over-the-air.
# ----------------------------------------------------------------------------
# step "Frontend → EAS Update (OTA) on the production channel"
# npx eas update --branch production -m "$MSG" $EAS_FLAGS

step "Done."
echo "• Backend: redeploying on Render (watch the Render dashboard)."
echo "• Frontend: builds + store submissions are running on EAS — track at https://expo.dev"
