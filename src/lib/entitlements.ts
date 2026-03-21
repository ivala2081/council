/**
 * Central entitlements module.
 * Currently returns true for everything (all features free).
 * To activate paywall: change canStartGenesis to check build count from DB.
 */

export function canCreateBrief(): boolean {
  return true; // always free
}

export function canStartGenesis(_ownerToken: string): boolean {
  return true; // first free, then paid (future)
}

export function canCompare(): boolean {
  return true; // always free
}

export function getGenesisBuildsRemaining(_ownerToken: string): number {
  return Infinity; // unlimited for now
}
