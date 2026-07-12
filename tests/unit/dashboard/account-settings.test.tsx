import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  canSubmitAccountDeletion,
  purgeAccountBrowserState,
} from "../../../dashboard/src/lib/account-settings";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("account settings lifecycle UX", () => {
  it("enables destructive submission only for the exact phrase", () => {
    expect(canSubmitAccountDeletion(ACCOUNT_DELETE_CONFIRMATION)).toBe(true);
    expect(canSubmitAccountDeletion("delete my account")).toBe(false);
    expect(canSubmitAccountDeletion(`${ACCOUNT_DELETE_CONFIRMATION} `)).toBe(
      false,
    );
  });

  it("purges all Indy account state from session and local storage", () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    session.setItem("indyfren_auth_profile:user", "secret");
    session.setItem("other", "keep");
    local.setItem("indyfren_recent", "private");
    local.setItem("theme", "light");
    purgeAccountBrowserState({ sessionStorage: session, localStorage: local });
    expect(session.getItem("indyfren_auth_profile:user")).toBeNull();
    expect(local.getItem("indyfren_recent")).toBeNull();
    expect(session.getItem("other")).toBe("keep");
    expect(local.getItem("theme")).toBe("light");
  });
});
