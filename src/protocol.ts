export type Mode = "absolute" | "relative" | "pair" | "no-manifest" | "missing" | "invalid" | "share";
export type RunConfig = { mode: Mode };
export type Init = { phase: string; plugins: { name: string; path: string }[]; skills: string[]; commands: string[]; agents: string[]; mcpServers: { name: string; status: string }[]; pluginErrors: unknown[] };
export type Turn = { phase: string; status: string; text: string; sessionId: string; costUsd: number };
export type LabEvent =
 | { type: "fixtures"; files: { name: string; contents: string }[] }
 | { type: "options"; config: RunConfig; options: Record<string, unknown> }
 | { type: "initialized"; model: string; sessionId: string; metadata: Init }
 | { type: "mcp-status"; phase: string; servers: {name:string;status:string}[] }
 | { type: "message"; phase: string; sdkType: string; summary: string }
 | { type: "tool"; name: string; target: string }
 | { type: "answer"; text: string }
 | { type: "result"; status: string; text: string; sessionId: string; costUsd: number }
 | { type: "evidence"; mode: Mode; completedReads: string[]; returnedMarkers: string[]; pluginFilesUnchanged: boolean; hookReceipts: unknown[]; mcpStatuses: {phase:string;servers:{name:string;status:string}[]}[]; initializations: Init[]; turns: Turn[]; sdkQueries: number }
 | { type: "notice" | "error"; text: string };
