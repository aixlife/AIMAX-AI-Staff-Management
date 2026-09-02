/**
 * 라이브 운영실 모드 전용 API 클라이언트.
 *
 * - 이 파일은 소스 전체에서 네트워크 호출이 허용된 유일한 곳입니다
 *   (tests/ui-contract.test.ts 의 네트워크 계약이 강제합니다).
 * - 세션은 서버 발급 bearer 토큰(x-aimax-session-token 호환)이며
 *   localStorage 에만 저장합니다. 값은 로그·화면에 노출하지 않습니다.
 * - 프리뷰(랜딩) 빌드에서는 이 모듈이 임포트만 되고 호출되지 않습니다.
 */

const SESSION_TOKEN_KEY = "aimax_live_session_token";

/** 허용 엔드포인트 정본 — 계약 테스트가 이 목록과 실제 호출부를 대조합니다. */
export const ALLOWED_API_PATHS = [
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/workers",
  "/api/jobs",
] as const;

export type AllowedApiPath = (typeof ALLOWED_API_PATHS)[number];

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code || `http_${status}`);
    this.status = status;
    this.code = code || `http_${status}`;
  }
}

export function loadSessionToken(): string {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function saveSessionToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    else window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // 프라이빗 모드 등 저장 불가 환경에서는 세션이 탭 수명으로 제한됩니다.
  }
}

interface ApiRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** true면 401을 예외 대신 null 반환으로 처리합니다 (세션 확인용). */
  optionalAuth?: boolean;
}

export async function apiFetch<T>(
  path: AllowedApiPath,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  const token = loadSessionToken();
  if (token) headers["x-aimax-session-token"] = token;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(response.status, String(payload?.error || ""));
  }
  return payload as T;
}
