/**
 * In-memory session-unlock state. Reset on every JS reload (cold start),
 * which is exactly what we want: the lock screen reappears each time the app
 * is launched fresh, but in-app navigation stays unlocked.
 *
 * Lives in module scope intentionally — no React Context needed because the
 * lock decision happens only at the root navigator, not inside the tab tree.
 */
let unlocked = false;

export function isUnlockedForSession(): boolean {
  return unlocked;
}

export function markUnlockedForSession(): void {
  unlocked = true;
}

export function lockSession(): void {
  unlocked = false;
}
