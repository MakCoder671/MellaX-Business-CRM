const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

function extractMessage(body: unknown): string {
  if (typeof body === "string" && body) return body;
  if (Array.isArray(body) && body.length) return String(body[0]);
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if ("detail" in record) return extractMessage(record.detail);
    const firstKey = Object.keys(record)[0];
    if (firstKey) return extractMessage(record[firstKey]);
  }
  return "Something went wrong. Please try again.";
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(extractMessage(body));
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("mellax_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem("mellax_token", token);
  } else {
    window.localStorage.removeItem("mellax_token");
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Token ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}
