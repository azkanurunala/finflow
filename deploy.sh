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
#   ./deploy.sh ["commit message"]                       # = TARGET=all (backend + iOS + Android)
#
#   Choose what to deploy with TARGET — components joined by '+' ( ',' also works):
#     TARGET=all              ./deploy.sh   # backend + iOS + Android   (default)
#     TARGET=backend          ./deploy.sh   # backend only
#     TARGET=backend+ios      ./deploy.sh   # backend + iOS
#     TARGET=backend+android  ./deploy.sh   # backend + Android
#     TARGET=ios+android      ./deploy.sh   # iOS + Android (no backend)
#     TARGET=ios              ./deploy.sh   # iOS only
#     TARGET=android          ./deploy.sh   # Android only
#   (Legacy PLATFORM=ios|android|all still works → implies backend + that platform.)
#
#   "backend" = commit + push to `main` (Render auto-deploys). When 'backend' is
#   NOT selected, the working tree is still committed (so EAS builds your current
#   code) but is NOT pushed — the live API is left untouched.
#
#   CI=1 ./deploy.sh                                      # non-interactive (EXPO_TOKEN + creds)
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
EAS_FLAGS=""
[ "${CI:-0}" = "1" ] && EAS_FLAGS="--non-interactive"

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
die()  { printf "\n\033[1;31m✖ %s\033[0m\n" "$1" >&2; exit 1; }

command -v git >/dev/null || die "git not found."

# ----------------------------------------------------------------------------
# Resolve TARGET → which parts to deploy (backend / iOS / Android).
# ----------------------------------------------------------------------------
TARGET="${TARGET:-}"
# Back-compat: PLATFORM=ios|android|all implies backend + that platform.
if [ -z "$TARGET" ]; then
  case "${PLATFORM:-all}" in
    all)     TARGET="all" ;;
    ios)     TARGET="backend+ios" ;;
    android) TARGET="backend+android" ;;
    *)       die "PLATFORM must be: ios | android | all (got '${PLATFORM:-}'). Or use TARGET=..." ;;
  esac
fi

DEPLOY_BACKEND=0; DO_IOS=0; DO_ANDROID=0
_OLDIFS="$IFS"; IFS='+'
for _part in ${TARGET//,/+}; do
  case "$_part" in
    backend) DEPLOY_BACKEND=1 ;;
    ios)     DO_IOS=1 ;;
    android) DO_ANDROID=1 ;;
    all)     DEPLOY_BACKEND=1; DO_IOS=1; DO_ANDROID=1 ;;
    "")      ;;
    *)       IFS="$_OLDIFS"; die "Unknown TARGET component '$_part'. Valid: backend, ios, android, all (joined by '+')." ;;
  esac
done
IFS="$_OLDIFS"
[ "$DEPLOY_BACKEND" = 1 ] || [ "$DO_IOS" = 1 ] || [ "$DO_ANDROID" = 1 ] || die "TARGET='$TARGET' selects nothing to deploy."

# Store-path failure flags (referenced in the final summary; safe for backend-only runs).
IOS_FAILED=0
ANDROID_AAB_FAILED=0

cd "$ROOT"

# Use the repo's pinned Node 22 if nvm is available.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null 2>&1 || true
fi
echo "Node: $(node -v 2>/dev/null || echo '??')"
echo "Deploying → backend=$DEPLOY_BACKEND  iOS=$DO_IOS  Android=$DO_ANDROID   (TARGET=$TARGET)"

# ----------------------------------------------------------------------------
# 1) GIT — snapshot the working tree on `main` so EAS builds exactly this code.
#    Pushing (which triggers the Render backend redeploy) happens ONLY when
#    'backend' is part of TARGET.
# ----------------------------------------------------------------------------
step "Git → commit working tree on '$BRANCH'"
CUR="$(git rev-parse --abbrev-ref HEAD)"
[ "$CUR" = "$BRANCH" ] || die "You are on '$CUR'. Switch to '$BRANCH' first (git checkout $BRANCH)."

git add -A
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
fi

if [ "$DEPLOY_BACKEND" = 1 ]; then
  step "Backend → push to '$BRANCH' (Render auto-deploys the live API)"
  git push origin "$BRANCH"
  if [ -n "${RENDER_DEPLOY_HOOK_URL:-}" ]; then
    step "Triggering Render deploy hook"
    curl -fsS "$RENDER_DEPLOY_HOOK_URL" >/dev/null && echo "Render deploy triggered."
  fi
else
  step "Backend → skipped (TARGET has no 'backend' → not pushing; Render left untouched)"
  echo "    Any local commit stays unpushed; a later backend deploy will push it."
fi

# ----------------------------------------------------------------------------
# 2) FRONTEND — build the selected platforms (production) + submit to stores.
#    --auto-submit uploads each build to its store right after it finishes.
#    The Android release .apk is always built FIRST and independently of the
#    store paths, so it survives an iOS or Play Store failure.
# ----------------------------------------------------------------------------
if [ "$DO_IOS" = 1 ] || [ "$DO_ANDROID" = 1 ]; then
  cd "$FRONTEND"

  # Fail early with a clear message if not authenticated.
  npx --yes eas-cli@latest whoami >/dev/null 2>&1 || die "Not logged in to EAS. Run: cd frontend && npx --yes eas-cli@latest login   (or export EXPO_TOKEN)."

  HAS_PLAY_KEY=0
  [ -f "$FRONTEND/play-service-account.json" ] && HAS_PLAY_KEY=1

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

  # Order matters: build the Android release .apk FIRST so it is always produced,
  # then the best-effort store paths (iOS, then Android .aab) which are non-fatal.
  if [ "$DO_ANDROID" = 1 ]; then
    build_android_apk
  fi
  if [ "$DO_IOS" = 1 ]; then
    build_ios || IOS_FAILED=1
  fi
  if [ "$DO_ANDROID" = 1 ]; then
    if [ "$HAS_PLAY_KEY" = "1" ]; then
      build_android || ANDROID_AAB_FAILED=1
    else
      printf "\n\033[1;33m⏭  Skipping Android .aab submit: no Play Console key yet.\033[0m\n"
      echo "   The release .apk above is built for direct distribution. When ready for Play,"
      echo "   add frontend/play-service-account.json (auto-submit), or run TARGET=android."
    fi
  fi
else
  step "Frontend → skipped (TARGET has no iOS/Android; backend-only deploy)."
fi

# ----------------------------------------------------------------------------
# 3) (optional) OTA update for users already on a matching build.
#    Uncomment if you also want to push JS-only updates over-the-air.
# ----------------------------------------------------------------------------
# step "Frontend → EAS Update (OTA) on the production channel"
# npx --yes eas-cli@latest update --branch production -m "$MSG" $EAS_FLAGS

step "Done."
[ "$DEPLOY_BACKEND" = 1 ] && echo "• Backend: redeploying on Render (watch the Render dashboard)."
{ [ "$DO_IOS" = 1 ] || [ "$DO_ANDROID" = 1 ]; } && echo "• Frontend: builds + store submissions are running on EAS — track at https://expo.dev"
[ "$DO_ANDROID" = 1 ] && echo "• Android release .apk: download it from its build page on https://expo.dev once done."

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
