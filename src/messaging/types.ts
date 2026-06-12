const MESSAGING_PLATFORMS = ["telegram", "whatsapp"] as const;

export type MessagingPlatform = (typeof MESSAGING_PLATFORMS)[number];

export function isMessagingPlatform(value: string): value is MessagingPlatform {
  return MESSAGING_PLATFORMS.includes(value as MessagingPlatform);
}
