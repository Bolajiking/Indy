import type { DashboardAuthStage } from "@/lib/auth-state";

export function shouldShowDebugAccessTokenPanel(input: {
  nodeEnv: string | undefined;
  authenticated: boolean;
  stage: DashboardAuthStage;
  accessToken: string | null;
}): boolean {
  if (input.nodeEnv !== "development") {
    return false;
  }

  if (!input.authenticated) {
    return false;
  }

  if (!input.accessToken?.trim()) {
    return false;
  }

  return input.stage !== "loading" && input.stage !== "signed_out";
}
