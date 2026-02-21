import { ArenaEngine } from "../engine";
import { AuthErrorCode, SessionClaims } from "../auth/AuthManager";

export interface AuthFailure {
  success: false;
  status: number;
  code: AuthErrorCode | "SESSION_GAME_ENDED";
  message: string;
}

export interface AuthSuccess {
  success: true;
  claims: SessionClaims;
}

export type AuthValidationResult = AuthFailure | AuthSuccess;

function statusForAuthCode(code: AuthFailure["code"]): number {
  if (code === "AUTH_REQUIRED") return 401;
  if (code === "TOKEN_INVALID" || code === "TOKEN_EXPIRED" || code === "SESSION_GAME_ENDED") return 401;
  if (code === "TOKEN_SCOPE_MISMATCH" || code === "TOKEN_CHALLENGE_MISMATCH") return 403;
  return 400;
}

export async function validateSessionForChallenge(options: {
  engine: ArenaEngine;
  token: string | null;
  expectedChallengeId: string;
  requiredScope: string;
}): Promise<AuthValidationResult> {
  const { engine, token, expectedChallengeId, requiredScope } = options;

  if (!token) {
    const err = engine.auth.buildAuthRequiredError();
    return {
      success: false,
      status: statusForAuthCode(err.code),
      code: err.code,
      message: err.message,
    };
  }

  const verify = engine.auth.verifySessionToken(token, requiredScope);
  if (!verify.success) {
    return {
      success: false,
      status: statusForAuthCode(verify.code),
      code: verify.code,
      message: verify.message,
    };
  }

  if (verify.data.challengeId !== expectedChallengeId) {
    const err = engine.auth.buildChallengeMismatchError(expectedChallengeId);
    return {
      success: false,
      status: statusForAuthCode(err.code),
      code: err.code,
      message: err.message,
    };
  }

  const challenge = await engine.getChallenge(verify.data.challengeId);
  if (challenge?.instance?.state?.gameEnded) {
    engine.auth.revokeSessionsForChallenge(verify.data.challengeId);
    return {
      success: false,
      status: 401,
      code: "SESSION_GAME_ENDED",
      message: "Session is invalid because the game has ended",
    };
  }

  return {
    success: true,
    claims: verify.data,
  };
}

export function authErrorResponse(err: AuthFailure): { error: string; code: string } {
  return {
    error: err.message,
    code: err.code,
  };
}
