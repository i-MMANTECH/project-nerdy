/** Signed session cookie — must match `lib/session.ts`. */
export const BILLING_SESSION_COOKIE_NAME = "billing_session";

/** Internal: `middleware.ts` sets this on admin requests so layouts can `redirect(/login?next=…)`. */
export const ADMIN_LOGIN_NEXT_HEADER = "x-billing-admin-login-next";
