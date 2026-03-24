const CREATOR_SERVICE_OUTAGE_FRAGMENT =
  "creator service is temporarily unavailable";

export function isCreatorServiceOutage(error: string | null | undefined): boolean {
  return error?.toLowerCase().includes(CREATOR_SERVICE_OUTAGE_FRAGMENT) ?? false;
}

export function getRegistrationErrorCopy(
  error: string | null | undefined
): string | null {
  if (!error) {
    return null;
  }

  if (isCreatorServiceOutage(error)) {
    return "Sign-in worked, but Indyfren could not reach the creator profile service. Your details are still here, so retry profile creation in a moment.";
  }

  return error;
}

export function getProfileSaveErrorCopy(
  error: string | null | undefined
): string | null {
  if (!error) {
    return null;
  }

  if (isCreatorServiceOutage(error)) {
    return "Profile save could not reach the creator service. Retry in a moment and your latest edits should go through cleanly.";
  }

  return error;
}
