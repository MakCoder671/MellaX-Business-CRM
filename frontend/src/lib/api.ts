// ----------------------------------------------------------------------------
// This is the ONE place in the whole frontend that actually talks to the
// Django backend over HTTP. Every page imports `apiFetch` from here
// instead of calling `fetch()` directly — that way things like "attach
// the auth token" and "turn error responses into a readable message"
// only need to be written once.
// ----------------------------------------------------------------------------

// Where the backend API lives. In development this comes from
// .env.local (NEXT_PUBLIC_API_URL=http://127.0.0.1:8001). The
// NEXT_PUBLIC_ prefix is a Next.js convention — it means "it's safe to
// bake this into the browser-side JavaScript bundle" (as opposed to a
// secret that should only ever live on a server).
const API_BASE_URL = "";

// Django REST Framework sends back errors in a few different shapes
// depending on what went wrong:
//   { "detail": "Invalid email or password." }              <- a general error
//   { "email": ["This field is required."] }                <- a specific field's error
//   ["Something went wrong."]                                <- a plain list
// This function digs through all of those shapes and pulls out ONE
// readable string, so the UI never has to show a raw error object or a
// stack trace to the user (see business_plan.MD's "plain-language
// errors" rule).
function extractMessage(body: unknown): string {
  if (typeof body === "string" && body) return body;
  if (Array.isArray(body) && body.length) return String(body[0]);
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if ("detail" in record) return extractMessage(record.detail);
    // Grab whatever the FIRST field's error is — good enough for a
    // simple "here's what went wrong" message without building a whole
    // form-validation UI for every possible field.
    const firstKey = Object.keys(record)[0];
    if (firstKey) return extractMessage(record[firstKey]);
  }
  return "Something went wrong. Please try again.";
}

// A custom Error subclass so calling code can do
// `err instanceof ApiError` to tell "the API responded with an error" apart
// from other kinds of failures (like a network being down entirely).
export class ApiError extends Error {
  status: number; // the HTTP status code, e.g. 400, 404, 500
  body: unknown; // the raw error response, in case something needs more detail than just the message

  constructor(status: number, body: unknown) {
    super(extractMessage(body)); // sets this.message to the human-readable string
    this.status = status;
    this.body = body;
  }
}

// The auth token (from login) gets stored in the browser's localStorage
// so it survives page refreshes — the user doesn't have to log in again
// every time they reload the page. `typeof window === "undefined"` is a
// safety check for Next.js: some of this code can theoretically run on
// the server, where there IS no browser/localStorage.
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("mellax_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem("mellax_token", token);
  } else {
    window.localStorage.removeItem("mellax_token"); // used on logout
  }
}

// The main function every page uses to talk to the backend.
//
// Example usage:
//   const clients = await apiFetch<Client[]>("/api/clients/")
//   await apiFetch("/api/clients/", { method: "POST", body: { name: "Jane" } })
//
// The <T> is a TypeScript "generic" — it lets each call site say what
// shape of data it expects back, so `clients` above is typed as
// Client[] instead of just `any`.
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};

  if (auth) {
    // Attach "Authorization: Token <key>" so the backend knows who's
    // asking (see accounts/views.py's LoginView on the Django side —
    // that's what hands out this token in the first place). Endpoints
    // like signup/login themselves pass `auth: false` since there's no
    // token to send yet.
    const token = getToken();
    if (token) headers["Authorization"] = `Token ${token}`;
  }

  // A file upload (like a logo) has to be sent as FormData, not JSON —
  // browsers can't JSON.stringify a File. When the caller already built
  // a FormData object themselves (see Settings' branding form), we send
  // it as-is and skip the "Content-Type: application/json" header
  // entirely — the browser sets its own Content-Type for FormData
  // automatically, including a required "boundary" value we couldn't
  // easily set by hand.
  const isFormData = body instanceof FormData;
  if (!isFormData) headers["Content-Type"] = "application/json";

  console.log("[v0] apiFetch requesting", `${API_BASE_URL}${path}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return undefined as T; // "204 No Content" means success with nothing to return (e.g. DELETE, logout)

  const data = await response.json().catch(() => ({})); // .catch handles the rare case of a non-JSON response body

  if (!response.ok) {
    // response.ok is false for any 4xx/5xx status — throw so calling
    // code can catch it with a normal try/catch, instead of having to
    // remember to check response.ok everywhere.
    throw new ApiError(response.status, data);
  }

  return data as T;
}
