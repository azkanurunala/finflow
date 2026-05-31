#!/usr/bin/env bash
# =============================================================================
# FinFlow — one-shot deploy
#   • Backend : commit + push to `main`  → Render auto-deploys the LIVE service.
#   • Frontend: EAS build (iOS + Android, production) + auto-submit to
#               App Store (TestFlight) and Google Play.
#               Android also produces a directly-installable release .apk
#               (sideload / direct download) in addition to the .aab.
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
#   2. Expo auth: `npx --yes eas-cli@latest login` once  (or `export EXPO_TOKEN=...` for CI).
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
npx --yes eas-cli@latest whoami >/dev/null 2>&1 || die "Not logged in to EAS. Run: cd frontend && npx --yes eas-cli@latest login   (or export EXPO_TOKEN)."

HAS_PLAY_KEY=0
[ -f "$FRONTEND/play-service-account.json" ] && HAS_PLAY_KEY=1

# Track store-path failures. The release .apk is built independently and must
# always be produced even if either of these is 1.
IOS_FAILED=0           # iOS build/submit to App Store
ANDROID_AAB_FAILED=0   # Android .aab build/submit to Play Store

build_ios() {
  step "iOS → build (production) + auto-submit to App Store"
  # shellcheck disable=SC2086
  npx --yes eas-cli@latest build -p ios --profile production --auto-submit $EAS_FLAGS
}

build_android() {
  if [ "$HAS_PLAY_KEY" = "1" ]; then
    step "Android → build .aab (production) + auto-submit to Play Store"
    # shellcheck disable=SC2086
    npx --yes eas-cli@latest build -p android --profile production --auto-submit $EAS_FLAGS
  else
    step "Android → build .aab ONLY (no Play key yet → submit skipped, won't prompt)"
    echo "    No frontend/play-service-account.json found. Google requires the FIRST"
    echo "    Play release to be uploaded manually anyway — use the .aab this produces."
    # shellcheck disable=SC2086
    npx --yes eas-cli@latest build -p android --profile production $EAS_FLAGS
  fi
}

build_android_apk() {
  step "Android → build release .apk (production-apk profile — direct install / sideload)"
  echo "    .apk can't be submitted to Play (Play requires the .aab); this build is for"
  echo "    direct distribution. Download it from the build's page on https://expo.dev."
  # shellcheck disable=SC2086
  npx --yes eas-cli@latest build -p android --profile production-apk $EAS_FLAGS
}

# NOTE: the release .apk is ALWAYS built first and is independent of the iOS and
# Play Store paths. If the iOS build/submit, the .aab build, or the Play submit
# fails, we record it (non-fatal) and keep going so the .apk is still produced;
# any such failure is reported at the end with a non-zero exit.
case "$PLATFORM" in
  ios)     build_ios ;;
  android)
    build_android_apk
    build_android || ANDROID_AAB_FAILED=1
    ;;
  all)
    build_android_apk                       # priority artifact — built first, always
    build_ios || IOS_FAILED=1               # best-effort: iOS failure must not block the .apk
    if [ "$HAS_PLAY_KEY" = "1" ]; then
      build_android || ANDROID_AAB_FAILED=1 # best-effort: .aab/Play failure must not block the .apk
    else
      printf "\n\033[1;33m⏭  Skipping Android .aab submit: no Play Console key yet.\033[0m\n"
      echo "   The release .apk above is built for direct distribution. When ready for Play,"
      echo "   add frontend/play-service-account.json (auto-submit), or run PLATFORM=android."
    fi
    ;;
esac

# ----------------------------------------------------------------------------
# 3) (optional) OTA update for users already on a matching build.
#    Uncomment if you also want to push JS-only updates over-the-air.
# ----------------------------------------------------------------------------
# step "Frontend → EAS Update (OTA) on the production channel"
# npx --yes eas-cli@latest update --branch production -m "$MSG" $EAS_FLAGS

step "Done."
echo "• Backend: redeploying on Render (watch the Render dashboard)."
echo "• Frontend: builds + store submissions are running on EAS — track at https://expo.dev"
echo "• Android release .apk: download it from its build page on https://expo.dev once done."

# The release .apk has already been built above. If only the store paths (iOS
# App Store and/or Android .aab→Play) failed, surface them as a non-zero exit
# without undoing the .apk that was already produced.
DEPLOY_FAILED=0
if [ "$IOS_FAILED" = "1" ]; then
  printf "\n\033[1;33m⚠  iOS build/submit to App Store FAILED — check its build logs on https://expo.dev.\033[0m\n" >&2
  DEPLOY_FAILED=1
fi
if [ "$ANDROID_AAB_FAILED" = "1" ]; then
  printf "\n\033[1;33m⚠  Android .aab build/submit to Play Store FAILED — but the release .apk was\n   still generated (see its build page on https://expo.dev). Check the .aab logs there.\033[0m\n" >&2
  DEPLOY_FAILED=1
fi
if [ "$DEPLOY_FAILED" = "1" ]; then
  exit 1
fi
