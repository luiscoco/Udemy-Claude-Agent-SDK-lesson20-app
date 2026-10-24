# Claude Agent SDK · Lesson 20 · Plugins: package it all

Based on Lesson20_Plugins.pptx. Five linked student pages, large text and coloured source code at all 13 UML steps.

## What you will learn

- Package reusable capabilities: A local plugin can bundle skills, agent definitions, hooks and MCP servers. Inspect the actual classroom bundle in the file viewer.
- Load local roots explicitly: Pass plugins: [{type: "local", path}]. Compare an absolute path with a path relative to the query cwd. The path must identify the plugin root; tilde expansion and marketplace downloading are not performed here.
- Verify actual initialization: Inspect init.plugins, skills, slash_commands and plugin_errors. The app also records agent discovery and actual MCP connection metadata. Built-in plugin entries can appear independently.
- Dispatch namespaced skills: Send /classroom-tools:greet or /classroom-notes:greet. Both plugins contain greet, but their namespaces select different instructions and response markers.
- Inspect optional manifests and failures: Compare a working manifest-free plugin with a nonexistent root and a corrupt manifest. A completed greeting does not mean the requested plugin loaded.
- Share a bundle across projects: Load the same unchanged classroom-tools directory from two private working projects. Verify different project facts and the same plugin path. Agent discovery and MCP connection are observed; subagent and MCP tool execution are not demonstrated.

## Configure and run

```powershell
git clone https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson20-app.git
cd .\Udemy-Claude-Agent-SDK-lesson20-app
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

From presentations, use `cd .\agent-sdk\lesson20-plugins` instead of cloning. Open http://127.0.0.1:3120. Keep the terminal running. Node.js 24+ and model access are required.

## Create your .env file

Preserve an existing file or copy .env.example. Enter your key locally. Restart after edits. Existing shell values take precedence.

```dotenv
ANTHROPIC_API_KEY=your_api_key
CLAUDE_MODEL=claude-sonnet-4-6
PORT=3120
# Windows if needed: CLAUDE_CODE_GIT_BASH_PATH=C:/Program Files/Git/bin/bash.exe
```

No Managed Agents resource ID is needed. On Windows configure Git Bash if necessary. Do not commit the real .env.

## Run the experiments

### Load and verify

Run Absolute and Relative. Inspect the actual local roots, initialization, completed manifest Read and SessionStart hook receipt. Agent definitions and MCP connections are metadata observations, not execution claims.

```powershell
npm run sample:env -- absolute
npm run sample:env -- relative
```

### Compare namespaces and layout

Run Pair to dispatch two greet skills using different prefixes. Then run No manifest to observe component discovery without plugin.json. Inspect the actual saved plugin files.

```powershell
npm run sample:env -- pair
npm run sample:env -- no-manifest
```

### Troubleshoot and share

Run Missing and Invalid. Inspect the requested plugin’s absence and plugin_errors separately from an ordinary greeting result. Then run Share: projects A and B use the same unchanged plugin directory.

```powershell
npm run sample:env -- missing
npm run sample:env -- invalid
npm run sample:env -- share
npm test
```

## How the app was built

### 1. Validate the plugin experiment

Accept a listed classroom mode. Browser input cannot supply arbitrary plugin code, remote locations or filesystem paths.

Source: `src/agent.ts`, lines 15–16. Selected excerpt; surrounding code omitted.

```typescript
if (!value || typeof value !== "object" || Array.isArray(value) || !MODES.includes((value as RunConfig).mode)) throw new Error("Choose a listed plugin experiment.");
 return { mode: (value as RunConfig).mode };
```

### 2. Prepare two private projects

Write distinct project manifests in owned private directories. The shared plugin is kept outside those projects and is not modified.

Source: `src/agent.ts`, lines 45–46. Selected excerpt; surrounding code omitted.

```typescript
for (const [cwd, project] of [[d.cwd,"PROJECT-A-20"],[d.second,"PROJECT-B-20"]])
  await writeFile(resolve(cwd,"classroom.json"),JSON.stringify({project,topic:"Local SDK plugins",task:"Verify namespaced plugin skills"},null,2));
```

### 3. Resolve the intended local root

Compare a fixed absolute plugin root with a path relative to the query working directory. The selected path identifies the root, not the skills subdirectory.

Source: `src/agent.ts`, lines 26–28. Selected excerpt; surrounding code omitted.

```typescript
const first = resolve(PLUGINS, "classroom-tools");
 if (c.mode === "relative") return [relative(cwd, first).replaceAll("\\", "/")];
 return c.mode === "pair" ? [first, resolve(PLUGINS, "classroom-notes")] : [first];
```

### 4. Pass local plugin configuration

Configure each plugin with type local. Explicit plugin loading is separate from filesystem settings and model skill scope.

Source: `src/agent.ts`, lines 57–59. Selected excerpt; surrounding code omitted.

```typescript
plugins: pluginPaths(c,cwd,d.root).map(path => ({type:"local" as const,path})),
  settingSources:[], skills:[], tools:["Read"], allowedTools:["Read"],
  disallowedTools:["Bash","Write","Edit","Agent","WebFetch","WebSearch"],
```

### 5. Dispatch the namespaced prompt

Send the plugin-prefixed greet name as an ordinary prompt. Its argument identifies the exact project manifest the skill may read.

Source: `src/agent.ts`, lines 84–84. Selected excerpt; surrounding code omitted.

```typescript
const prompt=["missing","invalid"].includes(c.mode) ? PROMPTS.ordinary : `/${plugin}:greet Read this exact manifest: ${JSON.stringify(resolve(cwd,"classroom.json").replaceAll("\\","/"))}`;
```

### 6. Run the actual SDK query

The SDK runtime loads the local bundle and manages Claude’s native message and tool loop. The host does not fabricate a plugin response.

Source: `src/agent.ts`, lines 85–86. Selected excerpt; surrounding code omitted.

```typescript
const run=query({prompt,options});let gotResult=false;
  try {
```

### 7. Inspect loaded plugins and diagnostics

Preserve actual plugin rows and plugin_errors. Built-in entries may coexist with the classroom plugin; a missing requested root is still a loading failure.

Source: `src/agent.ts`, lines 91–91. Selected excerpt; surrounding code omitted.

```typescript
phase,plugins:message.plugins,pluginErrors:message.plugin_errors || [],
```

### 8. Inspect namespaced components

Read namespaced skills and commands, discovered agents and MCP connection status. Discovery and connection do not establish agent or tool invocation.

Source: `src/agent.ts`, lines 92–93. Selected excerpt; surrounding code omitted.

```typescript
skills:message.skills,commands:message.slash_commands,
      agents:message.agents || [],mcpServers:message.mcp_servers,
```

### 9. Observe the plugin’s real hook

The packaged SessionStart hook writes a receipt to the private path supplied by the host. It does not write into the shared plugin directory.

Source: `plugins/classroom-tools/hooks/observe.cjs`, lines 6–8. Selected excerpt; surrounding code omitted.

```typescript
const event=JSON.parse(input);
 // The host supplies an owned private receipt path; never write into the plugin.
 if(process.env.PLUGIN_LAB_RECEIPT)writeFileSync(process.env.PLUGIN_LAB_RECEIPT,JSON.stringify({source:"plugin SessionStart",sessionId:event.session_id,event:event.hook_event_name}),{mode:0o600});
```

### 10. Connect the packaged local MCP server

The bundled stdio server uses the official MCP SDK. This lesson verifies its connection metadata and does not call its tool.

Source: `plugins/classroom-tools/mcp/server.mjs`, lines 6–6. Selected excerpt; surrounding code omitted.

```typescript
await server.connect(new StdioServerTransport());
```

### 11. Record completed manifest Reads

A successful host tool hook records the actual project-manifest Read. Response markers are checked separately from these completed calls.

Source: `src/agent.ts`, lines 65–66. Selected excerpt; surrounding code omitted.

```typescript
if(input.hook_event_name==="PostToolUse" && input.tool_name==="Read")completedReads.push(phase+":"+relative(cwd,resolve(cwd,String((input.tool_input as {file_path:string}).file_path))).replaceAll("\\","/"));
    return {};
```

### 12. Reuse the same bundle across projects

The Share experiment starts queries in project A and project B using the same plugin root. Actual project facts and unchanged source hashes demonstrate the reuse.

Source: `src/agent.ts`, lines 80–80. Selected excerpt; surrounding code omitted.

```typescript
const stages=c.mode==="pair" ? [["tools",d.cwd,"classroom-tools"],["notes",d.cwd,"classroom-notes"]] : c.mode==="share" ? [["project-a",d.cwd,"classroom-tools"],["project-b",d.second,"classroom-tools"]] : [["main",d.cwd,c.mode==="no-manifest" ? "classroom-lite" : "classroom-tools"]];
```

### 13. Format actual assistant answers

Parse and sanitize real Markdown answers. Keep plugin metadata, diagnostics, hook receipts and result text distinct.

Source: `src/client.ts`, lines 19–21. Selected excerpt; surrounding code omitted.

```typescript
if (e.type === "answer") renderMarkdown($("answer"), e.text);
  if (e.type === "result") {
    $("status").textContent = e.status; $("cost").textContent = "$" + e.costUsd.toFixed(5);
```

## Reference topics and limits

- Trust the bundle you load: Plugins can start hooks and local MCP processes. This app loads only the included trusted classroom code and fixed paths. The browser cannot select arbitrary plugins.
- Optional manifest: The manifest declares a stable name and version, but layout can supply components without it. classroom-lite demonstrates this observed loader behavior.
- MCP and agent evidence: The app records the plugin’s discovered coach definition and connected local stdio server. It does not invoke a subagent or the MCP tool. The hook receipt, however, comes from an actual executed SessionStart process.
- MCP configuration: strictMcpConfig is false here so the plugin’s packaged MCP definition can load. Homes and SDK configuration are private; filesystem setting sources are empty and claude.ai MCP is disabled. Model tool guards still reject every target except the project manifest.
- Troubleshooting: Check root path, JSON syntax, readability, existence, namespace and skills/name/SKILL.md. The SDK may report missing paths in plugin_errors while continuing the ordinary conversation. Built-in plugins may still be listed.
- Local paths and distribution: The SDK receives local directories. Download a marketplace or repository plugin before passing its local root. The app demonstrates sharing one local directory across two projects; it does not publish a marketplace plugin.

The controls show actual results rather than saved model answers. Session transcripts, local runtime files, dependencies and all media remain excluded from Git.

## References

- [Plugins in the SDK](https://code.claude.com/docs/en/agent-sdk/plugins)
- [Plugin structure reference](https://code.claude.com/docs/en/plugins-reference)
- [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Regenerate the five student pages with `python scripts/build-pages.py`.
