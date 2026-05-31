# Store submit credentials (for unattended `CI=1 ./deploy.sh`)

Fill these once so `eas submit` / `--auto-submit` works non-interactively. The
secret files (`.p8`, service-account JSON) are gitignored — never commit them.

## iOS — App Store Connect API key
Referenced by `frontend/eas.json` → `submit.production.ios`.

1. App Store Connect → **Users and Access** → **Integrations** tab → **App Store Connect API**.
2. Under **Team Keys** → **Generate API Key** (or **+**). Name it (e.g. "EAS CI"),
   **Access: App Manager**. Generate.
3. **Download** the key file — you can only download it ONCE. Save it as:
   `frontend/asc-api-key.p8`
4. Note these and put them in `frontend/eas.json` (replace the placeholders):
   - **Key ID** (the row's Key ID)        → `ascApiKeyId`
   - **Issuer ID** (top of the Keys page) → `ascApiKeyIssuerId`
5. **ascAppId** = your app's App Store Connect Apple ID:
   App Store Connect → **Apps** → FinFlow → **App Information** → General → **Apple ID** (a number).
   → put in `ascAppId`.

After this, `eas.json` `submit.production.ios` has real values + `frontend/asc-api-key.p8`
exists, and `eas submit -p ios` / `eas build --auto-submit` run with no prompts.

⚠️ Until the `.p8` exists and the 3 placeholders are replaced, do NOT use
`--auto-submit` — `eas submit` will fail looking for the key. For a one-off build
before then, run `eas build -p ios --profile production` WITHOUT `--auto-submit`,
then submit interactively with `eas submit -p ios --latest`.

## Android — Google Play service account
Referenced by `submit.production.android`.

1. Play Console → **Setup → API access** (or Google Cloud) → create a **service account**
   with Play Console access; grant it release permissions.
2. Download its **JSON key** → save as `frontend/play-service-account.json`.
3. First Play release must be uploaded manually once; after that `eas submit -p android` works.
