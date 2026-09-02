/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "live"면 실 API 연결 운영실 베타, 그 외에는 로컬 프리뷰 모드. */
  readonly VITE_CONSOLE_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
