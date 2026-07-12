const DEFAULT_SUPPORT_EMAIL = "support@chainfren.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const configuredSupportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;

if (!EMAIL_PATTERN.test(configuredSupportEmail)) {
  throw new Error("NEXT_PUBLIC_SUPPORT_EMAIL must be a valid public email");
}

export const publicSupportEmail = configuredSupportEmail;
