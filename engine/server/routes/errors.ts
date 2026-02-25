import { Context } from "hono";

export function errorResponse(c: Context, status: number, code: string, message: string) {
  return c.json({ error: message, code }, status);
}

export function validationError(c: Context, message: string) {
  return errorResponse(c, 400, "INVALID_REQUEST", message);
}

export function internalRouteError(
  c: Context,
  route: string,
  error: unknown,
  code: string,
  message: string,
) {
  const err = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
  console.error("[route_error]", { route, code, error: err });
  return errorResponse(c, 500, code, message);
}
