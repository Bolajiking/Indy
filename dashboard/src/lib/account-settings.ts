export const ACCOUNT_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
const RECEIPT_KEY = "indyfren_account_deletion_receipt";

export function canSubmitAccountDeletion(value: string): boolean {
  return value === ACCOUNT_DELETE_CONFIRMATION;
}

export function writeAccountDeletionReceipt(
  token: string,
  expiresAt: string,
): void {
  try {
    sessionStorage.setItem(RECEIPT_KEY, JSON.stringify({ token, expiresAt }));
  } catch {}
}

export function readAccountDeletionReceipt(): {
  token: string;
  expiresAt: string;
} | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(RECEIPT_KEY) ?? "null",
    );
    if (
      value &&
      typeof value === "object" &&
      typeof (value as { token?: unknown }).token === "string" &&
      typeof (value as { expiresAt?: unknown }).expiresAt === "string" &&
      Date.parse((value as { expiresAt: string }).expiresAt) > Date.now()
    ) {
      return value as { token: string; expiresAt: string };
    }
    sessionStorage.removeItem(RECEIPT_KEY);
  } catch {}
  return null;
}

export function clearAccountDeletionReceipt(): void {
  try {
    sessionStorage.removeItem(RECEIPT_KEY);
  } catch {}
}

export function purgeAccountBrowserState(storage?: {
  sessionStorage: Storage;
  localStorage: Storage;
}): void {
  const target =
    storage ??
    (typeof window !== "undefined"
      ? {
          sessionStorage: window.sessionStorage,
          localStorage: window.localStorage,
        }
      : null);
  if (!target) return;
  for (const store of [target.sessionStorage, target.localStorage]) {
    try {
      for (let index = store.length - 1; index >= 0; index--) {
        const key = store.key(index);
        if (key?.startsWith("indyfren_")) store.removeItem(key);
      }
    } catch {}
  }
}
