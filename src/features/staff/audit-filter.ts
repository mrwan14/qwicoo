/**
 * Automatic events a device sends on its own (a branch heartbeat every few seconds, a browser
 * registering for push). They flood the audit log and say nothing about what people did.
 */
const BACKGROUND = [/_HEARTBEAT$/, /_PUSH_SUBSCRIPTIONS$/];

export function isBackgroundAction(action: string | null | undefined): boolean {
  return Boolean(action) && BACKGROUND.some((pattern) => pattern.test(action!));
}
