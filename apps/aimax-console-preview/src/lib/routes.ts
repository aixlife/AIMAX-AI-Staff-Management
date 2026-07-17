import type { AppRoute } from "../types";

export const routes: Array<{
  id: AppRoute;
  label: string;
  shortLabel: string;
  description: string;
  icon: "home" | "employees" | "work" | "connections" | "help";
}> = [
  {
    id: "home",
    label: "홈",
    shortLabel: "홈",
    description: "확인할 일과 진행 중인 업무",
    icon: "home",
  },
  {
    id: "employees",
    label: "AI 직원",
    shortLabel: "직원",
    description: "직원 탐색과 업무 시작",
    icon: "employees",
  },
  {
    id: "work",
    label: "업무",
    shortLabel: "업무",
    description: "전체 업무와 결과",
    icon: "work",
  },
  {
    id: "connections",
    label: "연결 및 설정",
    shortLabel: "연결",
    description: "AI·데이터·실행기 상태",
    icon: "connections",
  },
  {
    id: "help",
    label: "도움말",
    shortLabel: "도움",
    description: "오류 보고와 지원",
    icon: "help",
  },
];

export function routeFromHash(hash: string): AppRoute {
  const candidate = hash.replace(/^#\/?/, "").split(/[?&]/)[0];
  return routes.some((route) => route.id === candidate)
    ? (candidate as AppRoute)
    : "home";
}

export function routeHash(route: AppRoute): string {
  return "#/" + route;
}
