type UsageEvent = "onboarding.complete" | "onboarding.skip" | "workspace.canvas" | "workspace.document";
type AgentOutcome = "success" | "failed" | "cancelled";
type CanvasSnapshot = { nodes: readonly { type?: string }[]; edgeCount: number };

// ACT: 官方遥测已移除，保留调用方使用的同名接口，本地不再收集或上报数据。
const anonymousData = {
  track(_event: UsageEvent) {},
  startAgent() {
    return (_outcome: AgentOutcome) => {};
  },
  observeCanvas(_read: () => CanvasSnapshot | undefined) {
    return () => {};
  },
};
export default anonymousData;
