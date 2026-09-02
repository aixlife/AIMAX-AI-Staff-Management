import { useState, type FormEvent } from "react";

interface LoginPageProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

/**
 * 라이브 운영실 베타의 로그인 화면.
 * 기존 운영실과 같은 계정·세션 API(/api/auth/login)를 씁니다.
 */
export function LoginPage({ onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(email.trim(), password);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(
        code === "invalid_credentials"
          ? "이메일 또는 비밀번호가 맞지 않습니다."
          : "로그인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="live-login" role="main">
      <form className="live-login__card" onSubmit={submit}>
        <span className="live-login__brand">AIMAX</span>
        <h1>운영실 베타 로그인</h1>
        <p className="live-login__lead">
          기존 운영실과 같은 계정으로 로그인합니다. 이 베타는 조회 전용이며,
          업무 실행은 기존 운영실에서 이어집니다.
        </p>
        <div className="field">
          <label htmlFor="live-login-email">이메일</label>
          <input
            id="live-login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="live-login-password">비밀번호</label>
          <input
            id="live-login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p className="live-login__error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button--primary" type="submit" disabled={busy}>
          {busy ? "확인 중" : "로그인"}
        </button>
        <a className="live-login__legacy" href="/app">
          기존 운영실로 가기
        </a>
      </form>
    </div>
  );
}
