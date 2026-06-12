import { describe, expect, it } from "vitest";
import {
  isUnfundedTempoWalletError,
  resolveMppSmokeExitCode,
} from "../../../scripts/test-mpp.ts";

describe("MPP smoke failure handling", () => {
  it("treats unfunded Tempo wallets as a failed readiness check by default", () => {
    expect(
      resolveMppSmokeExitCode("Execution reverted: InsufficientBalance"),
    ).toBe(1);
  });

  it("allows an explicit sandbox override for known unfunded wallets", () => {
    expect(
      resolveMppSmokeExitCode("Execution reverted: InsufficientBalance", {
        allowUnfundedWallet: true,
      }),
    ).toBe(0);
  });

  it("keeps missing live dependencies fatal even when the unfunded-wallet override is set", () => {
    expect(
      resolveMppSmokeExitCode("Unable to load a creator for smoke test", {
        allowUnfundedWallet: true,
      }),
    ).toBe(1);
  });

  it("recognizes current Tempo insufficient-balance failure wording", () => {
    expect(
      isUnfundedTempoWalletError(
        "ContractFunctionExecutionError: InsufficientBalance()",
      ),
    ).toBe(true);
    expect(isUnfundedTempoWalletError("Privy credentials are missing")).toBe(
      false,
    );
  });
});
