const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * FinFlow uses LOCAL notifications only (scheduled reminders) — never remote
 * push. expo-notifications adds the `aps-environment` (Push Notifications)
 * entitlement by default, which forces the iOS provisioning profile to include
 * the Push Notifications capability. We strip it so the existing App Store
 * provisioning profile stays valid (no capability/profile regeneration needed).
 * Local notifications do not require this entitlement.
 *
 * Must be listed BEFORE "expo-notifications" in app.json plugins: config-plugin
 * mods execute LIFO (last-added runs first), so listing this earlier makes its
 * mod run AFTER expo-notifications' — removing the key it just added.
 */
module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
};
