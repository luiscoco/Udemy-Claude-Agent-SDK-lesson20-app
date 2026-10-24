import test from "node:test";
import assert from "node:assert/strict";
import {resolve,isAbsolute} from "node:path";
import {validateConfig,pluginPaths,directories,lessonOptions,toolAllowed,PLUGINS} from "./agent.js";
test("only classroom experiment names are accepted, never browser-supplied plugin paths",()=>{
 assert.deepEqual(validateConfig({mode:"relative",path:"https://example.org"}),{mode:"relative"});
 for(const value of [null,[],{mode:"../plugin"},{mode:"marketplace"}])assert.throws(()=>validateConfig(value));
});
test("relative and absolute selections resolve to the same plugin root",()=>{
 const d=directories("relative","test"),paths=pluginPaths({mode:"relative"},d.cwd,d.root);
 assert.equal(isAbsolute(paths[0]),false);assert.equal(resolve(d.cwd,paths[0]),resolve(PLUGINS,"classroom-tools"));
 assert.ok(isAbsolute(pluginPaths({mode:"absolute"},d.cwd,d.root)[0]));
});
test("pair, optional manifest and failure modes select their intended local roots",()=>{
 const d=directories("pair","test");assert.equal(pluginPaths({mode:"pair"},d.cwd,d.root).length,2);
 assert.ok(pluginPaths({mode:"missing"},d.cwd,d.root)[0].endsWith("does-not-exist"));
 assert.ok(pluginPaths({mode:"invalid"},d.cwd,d.root)[0].endsWith("broken-plugin"));
 assert.ok(pluginPaths({mode:"no-manifest"},d.cwd,d.root)[0].endsWith("classroom-lite"));
});
test("plugin loading is independent of filesystem setting sources and model skill scope",()=>{
 const d=directories("absolute","test"),o=lessonOptions({mode:"absolute"},"test",d.cwd,"main",[]);
 assert.deepEqual(o.settingSources,[]);assert.deepEqual(o.skills,[]);assert.equal(o.plugins![0].type,"local");
 assert.deepEqual(o.tools,["Read"]);assert.equal(o.persistSession,false);assert.equal(o.strictMcpConfig,false);
 assert.ok(o.env!.PLUGIN_LAB_RECEIPT!.startsWith(d.root));
});
test("model tools are confined to the current project's manifest",()=>{
 const d=directories("share","test");assert.ok(toolAllowed(d.cwd,"Read",{file_path:"classroom.json"}));
 assert.equal(toolAllowed(d.cwd,"Read",{file_path:resolve(d.second,"classroom.json")}),false);
 assert.equal(toolAllowed(d.cwd,"Read",{file_path:".env"}),false);assert.equal(toolAllowed(d.cwd,"Bash",{}),false);assert.equal(toolAllowed(d.cwd,"mcp__classroom__course_label",{}),false);
});
