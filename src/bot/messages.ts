import type { MessagingPlatform } from "../messaging/types.js";

export type Platform = MessagingPlatform;

export interface IncomingMessage {
  platform: Platform;
  platformUserId: string;
  displayName: string;
  text: string;
}

export interface OutgoingMessage {
  text: string;
  parseMode?: "Markdown" | "HTML";
  buttons?: Array<{ text: string; callbackData: string }>;
}
