import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import type { RunConfig, Mode, LabEvent, Init, Turn } from "./protocol.js";
export type { RunConfig, LabEvent } from "./protocol.js";
export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
export const MODES: Mode[] = ["absolute", "relative", "pair", "no-manifest", "missing", "invalid", "share"];
export const DEFAULT_CONFIG: RunConfig = { mode: "absolute" };
export const PROMPTS = { ordinary: "Say hello in one brief sentence. Do not use skills or tools." };
export const PLUGINS = resolve(ROOT, "plugins");
export function validateConfig(value: unknown): RunConfig {
 if (!value || typeof value !== "object" || Array.isArray(value) || !MODES.includes((value as RunConfig).mode)) throw new Error("Choose a listed plugin experiment.");
 return { mode: (value as RunConfig).mode };
}
export function directories(mode: Mode, id: string) {
 const root = resolve(ROOT, ".runtime", mode, id);
 return { root, cwd: resolve(root, "project-a"), second: resolve(root, "project-b"), home: resolve(root, "home"), sdkHome: resolve(root, "sdk-home") };
}
export function pluginPaths(c: RunConfig, cwd: string, root: string) {
 if (c.mode === "missing") return [resolve(root, "does-not-exist")];
 if (c.mode === "invalid") return [resolve(root, "broken-plugin")];
 if (c.mode === "no-manifest") return [resolve(PLUGINS, "classroom-lite")];
 const first = resolve(PLUGINS, "classroom-tools");
 if (c.mode === "relative") return [relative(cwd, first).replaceAll("\\", "/")];
 return c.mode === "pair" ? [first, resolve(PLUGINS, "classroom-notes")] : [first];
}
export async function pluginFiles() {
 const files: { name: string; contents: string }[] = [];
 async function walk(dir: string) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
   const path = resolve(dir, entry.name);
   if (entry.isDirectory()) await walk(path);
   else files.push({ name: relative(ROOT, path).replaceAll("\\", "/"), contents: await readFile(path, "utf8") });
  }
 }
 await walk(PLUGINS); return files;
}
export async function prepareWorkspace(c: RunConfig, id: string) {
 const d = directories(c.mode, id);
 for (const folder of [d.cwd, d.second, d.home, d.sdkHome, resolve(d.root, "receipts"), resolve(d.root, "broken-plugin/.claude-plugin")]) await mkdir(folder, { recursive: true });
 await writeFile(resolve(d.root, "broken-plugin/.claude-plugin/plugin.json"), '{"name": }');
 for (const [cwd, project] of [[d.cwd,"PROJECT-A-20"],[d.second,"PROJECT-B-20"]])
  await writeFile(resolve(cwd,"classroom.json"),JSON.stringify({project,topic:"Local SDK plugins",task:"Verify namespaced plugin skills"},null,2));
 return d;
}
export function toolAllowed(cwd: string, name: string, input: Record<string, unknown>) {
 return name === "Read" && typeof input.file_path === "string" && resolve(cwd, input.file_path).toLowerCase() === resolve(cwd, "classroom.json").toLowerCase();
}
export function lessonOptions(c: RunConfig, id: string, cwd: string, phase: string, completedReads: string[], controller = new AbortController()): Options {
 const d = directories(c.mode,id), env = { ...process.env };
 for (const key of ["CLAUDE_CODE_DISABLE_CLAUDE_MDS","CLAUDE_CODE_DISABLE_ATTACHMENTS","OTEL_LOG_RAW_API_BODIES"]) delete env[key];
 return {
  model: MODEL, cwd, env: { ...env, HOME:d.home, USERPROFILE:d.home, CLAUDE_CONFIG_DIR:d.sdkHome, PLUGIN_LAB_RECEIPT:resolve(d.root,"receipts",phase+".json"), CLAUDE_CODE_DISABLE_AUTO_MEMORY:"1", ENABLE_CLAUDEAI_MCP_SERVERS:"false" },
  plugins: pluginPaths(c,cwd,d.root).map(path => ({type:"local" as const,path})),
  settingSources:[], skills:[], tools:["Read"], allowedTools:["Read"],
  disallowedTools:["Bash","Write","Edit","Agent","WebFetch","WebSearch"],
  systemPrompt:{type:"preset",preset:"claude_code",append:"Follow the explicitly dispatched classroom plugin skill. Read only the exact manifest supplied as its argument. Never run shell commands, edit files, invoke subagents or call MCP tools. Keep the answer to three brief bullets. An ordinary greeting needs no tool."},
  strictMcpConfig:false,mcpServers:{},persistSession:false,effort:"low",thinking:{type:"disabled"},maxTurns:6,maxBudgetUsd:0.4,abortController:controller,
  hooks:{
   PreToolUse:[{hooks:[async input=>input.hook_event_name==="PreToolUse" && !toolAllowed(cwd,input.tool_name,input.tool_input as Record<string,unknown>) ? {hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"Only the exact classroom manifest may be read."}} : {}]}],
   PostToolUse:[{hooks:[async input=>{
    if(input.hook_event_name==="PostToolUse" && input.tool_name==="Read")completedReads.push(phase+":"+relative(cwd,resolve(cwd,String((input.tool_input as {file_path:string}).file_path))).replaceAll("\\","/"));
    return {};
   }]}],
  },canUseTool:async()=>({behavior:"deny",message:"No additional model tool approvals in this classroom app."}),
 };
}
export function redact(text:string) {
 const key=process.env.ANTHROPIC_API_KEY;
 return (key ? text.split(key).join("[REDACTED]") : text).replace(/sk-ant-[A-Za-z0-9_-]{16,}/g,"[REDACTED]").slice(0,16000);
}
export async function runAgent(c:RunConfig,emit:(e:LabEvent)=>void,controller=new AbortController()) {
 c=validateConfig(c);const id=randomUUID(),d=await prepareWorkspace(c,id),files=await pluginFiles();
 const digest=(s:string)=>createHash("sha256").update(s).digest("hex"),before=new Map(files.map(f=>[f.name,digest(f.contents)]));
 emit({type:"fixtures",files});
 const completedReads:string[]=[],initializations:Init[]=[],turns:Turn[]=[],hookReceipts:unknown[]=[],mcpStatuses:{phase:string;servers:{name:string;status:string}[]}[]=[];
 const stages=c.mode==="pair" ? [["tools",d.cwd,"classroom-tools"],["notes",d.cwd,"classroom-notes"]] : c.mode==="share" ? [["project-a",d.cwd,"classroom-tools"],["project-b",d.second,"classroom-tools"]] : [["main",d.cwd,c.mode==="no-manifest" ? "classroom-lite" : "classroom-tools"]];
 for(const [phase,cwd,plugin] of stages) {
  const options=lessonOptions(c,id,cwd,phase,completedReads,controller);
  emit({type:"options",config:c,options:{phase,model:MODEL,plugins:options.plugins,settingSources:options.settingSources,skills:options.skills,tools:options.tools,allowedTools:options.allowedTools,cwd:c.mode==="share" ? phase : "owned project-a"}});
  const prompt=["missing","invalid"].includes(c.mode) ? PROMPTS.ordinary : `/${plugin}:greet Read this exact manifest: ${JSON.stringify(resolve(cwd,"classroom.json").replaceAll("\\","/"))}`;
  const run=query({prompt,options});let gotResult=false;
  try {
   for await(const message of run) {
    emit({type:"message",phase,sdkType:message.type,summary:"subtype" in message ? String(message.subtype) : "Actual SDK message"});
    if(message.type==="system" && message.subtype==="init") {
     const metadata:Init={
      phase,plugins:message.plugins,pluginErrors:message.plugin_errors || [],
      skills:message.skills,commands:message.slash_commands,
      agents:message.agents || [],mcpServers:message.mcp_servers,
     };
     initializations.push(metadata);emit({type:"initialized",model:message.model,sessionId:message.session_id,metadata});
     if(message.plugins.some(p=>p.name==="classroom-tools")) {
      let servers:{name:string;status:string}[]=[];
      for(let attempt=0;attempt<60;attempt++) {
       servers=(await run.mcpServerStatus())
        .filter(s=>s.name==="plugin:classroom-tools:classroom")
        .map(s=>({name:s.name,status:s.status}));
       if(servers.length && servers.every(s=>s.status!=="pending"))break;
       await new Promise(ok=>setTimeout(ok,250));
      }
      mcpStatuses.push({phase,servers});emit({type:"mcp-status",phase,servers});
     }
    }
    if(message.type==="assistant")for(const block of message.message.content) {
     if(block.type==="text")emit({type:"answer",text:redact(block.text)});
     if(block.type==="tool_use")emit({type:"tool",name:block.name,target:"owned classroom manifest"});
    }
    if(message.type==="result") {
     gotResult=true;turns.push({phase,status:message.subtype==="success" && message.is_error ? "error" : message.subtype,text:redact(message.subtype==="success" ? message.result : message.errors.join("\n")),sessionId:message.session_id,costUsd:message.total_cost_usd});
    }
   }
  }catch(error) {
   if(!gotResult)throw error;
   emit({type:"notice",text:"The single-shot iterator ended after its typed result. Inspect the actual result status."});
  }finally{run.close();}
  if(!gotResult)throw new Error("No typed SDK result received.");
  try{hookReceipts.push(JSON.parse(await readFile(resolve(d.root,"receipts",phase+".json"),"utf8")));}catch{/* The hook is absent from missing, malformed and lightweight plugins. */}
 }
 const pluginFilesUnchanged=(await pluginFiles()).every(f=>before.get(f.name)===digest(f.contents));
 const text=turns.map(t=>`### ${t.phase}\n\n${t.text}`).join("\n\n"),returnedMarkers=["TOOLS-PLUGIN-20","NOTES-PLUGIN-20","LITE-PLUGIN-20"].filter(m=>text.includes(m));
 const requiredReads=["missing","invalid"].includes(c.mode) || stages.every(([phase])=>completedReads.includes(phase+":classroom.json"));
 const connected=mcpStatuses.every(row=>row.servers.some(s=>s.status==="connected"));
 const status=connected && turns.every(t=>t.status==="success") && requiredReads && pluginFilesUnchanged ? "success" : "unverified";
 emit({type:"result",status,text,sessionId:turns.at(-1)!.sessionId,costUsd:turns.reduce((sum,t)=>sum+t.costUsd,0)});
 emit({type:"evidence",mode:c.mode,completedReads,returnedMarkers,pluginFilesUnchanged,hookReceipts,mcpStatuses,initializations,turns,sdkQueries:stages.length});
}
