import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import pino from "pino";
import {
  authenticateAccessToken,
  AuthTokenVerificationError,
} from "../../auth/session.js";

const log = pino({ name: "api:auth" });

export interface AuthContext {
  accessToken: string;
  privyUserId: string;
  creatorId: string | null;
  creatorResolutionError?: Error;
}

export const requirePrivyAuth = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  const authorization = c.req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Missing bearer token",
    });
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) {
    throw new HTTPException(401, {
      message: "Missing bearer token",
    });
  }

  try {
    const session = await authenticateAccessToken(accessToken);
    c.set("auth", session);
  } catch (error) {
    if (error instanceof AuthTokenVerificationError) {
      log.warn(
        { error: error.cause ?? error },
        "Bearer token verification failed",
      );
      throw new HTTPException(401, { message: "Invalid bearer token" });
    }

    log.warn({ error }, "Bearer token verification failed");
    throw new HTTPException(503, {
      message:
        "Authentication service is temporarily unavailable. Please retry in a moment.",
    });
  }

  await next();
});

export const requireCreatorAuth = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  await requirePrivyAuth(c, async () => {
    const auth = c.get("auth");
    if (auth.creatorResolutionError) {
      throw new HTTPException(503, {
        message: auth.creatorResolutionError.message,
      });
    }

    if (!auth.creatorId) {
      throw new HTTPException(403, {
        message: "Creator profile not registered",
      });
    }

    await next();
  });
});

export function getAuthContext(c: { get: (key: "auth") => AuthContext }) {
  return c.get("auth");
}

export function getRequiredCreatorId(c: {
  get: (key: "auth") => AuthContext;
}): string {
  const { creatorId } = getAuthContext(c);
  if (!creatorId) {
    throw new HTTPException(403, {
      message: "Creator profile not registered",
    });
  }

  return creatorId;
}
