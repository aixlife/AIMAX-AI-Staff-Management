import { useCallback, useEffect, useState } from "react";

import { App } from "./App";
import { ApiError, loadSessionToken, saveSessionToken } from "./api/client";
import { loadLiveData, login, logout, type LiveData } from "./api/live";
import { LoginPage } from "./pages/LoginPage";

type LiveState =
  | { phase: "checking" }
  | { phase: "login" }
  | { phase: "ready"; data: LiveData }
  | { phase: "error"; message: string };

/**
 * 라이브 운영실 베타의 루트.
 * 세션 확인 → 로그인 → 실데이터 적재 → 기존 프리뷰 화면에 주입.
 * Phase 1은 조회 전용이라 데이터 갱신은 수동 새로고침과 재접속으로 충분합니다.
 */
export function LiveRoot() {
  const [state, setState] = useState<LiveState>({ phase: "checking" });

  const refresh = useCallback(async () => {
    if (!loadSessionToken()) {
      setState({ phase: "login" });
      return;
    }
    try {
      const data = await loadLiveData();
      setState({ phase: "ready", data });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        saveSessionToken("");
        setState({ phase: "login" });
        return;
      }
      setState({
        phase: "error",
        message: "운영실 데이터를 불러오지 못했습니다. 네트워크 상태를 확인하고 새로고침해주세요.",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const result = await login(email, password);
      saveSessionToken(result.session_token);
      await refresh();
    },
    [refresh],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    saveSessionToken("");
    setState({ phase: "login" });
  }, []);

  if (state.phase === "checking") {
    return (
      <div className="live-login" role="status">
        <p className="live-login__lead">세션을 확인하고 있습니다…</p>
      </div>
    );
  }

  if (state.phase === "login") {
    return <LoginPage onSubmit={handleLogin} />;
  }

  if (state.phase === "error") {
    return (
      <div className="live-login" role="alert">
        <div className="live-login__card">
          <h1>불러오지 못했습니다</h1>
          <p className="live-login__lead">{state.message}</p>
          <button className="button button--primary" type="button" onClick={() => void refresh()}>
            다시 시도
          </button>
          <a className="live-login__legacy" href="/app">
            기존 운영실로 가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <App
      initialView="home"
      live={{
        data: state.data.fixture,
        userEmail: state.data.me.user.email,
        userName: state.data.me.user.name,
        onLogout: () => void handleLogout(),
        onRefresh: () => void refresh(),
      }}
    />
  );
}
