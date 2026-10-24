import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
const server=new McpServer({name:"classroom-plugin",version:"1.0.0"});
server.registerTool("course_label",{description:"Return a fixed classroom course label",inputSchema:{}},async()=>({content:[{type:"text",text:"Claude Agent SDK · Lesson 20 · Plugins"}]}));
// This lesson observes connection metadata; it does not invoke this tool.
await server.connect(new StdioServerTransport());
