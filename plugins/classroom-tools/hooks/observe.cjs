const {writeFileSync}=require("node:fs");
let input="";
process.stdin.setEncoding("utf8");
process.stdin.on("data",chunk=>input+=chunk);
process.stdin.on("end",()=>{
 const event=JSON.parse(input);
 // The host supplies an owned private receipt path; never write into the plugin.
 if(process.env.PLUGIN_LAB_RECEIPT)writeFileSync(process.env.PLUGIN_LAB_RECEIPT,JSON.stringify({source:"plugin SessionStart",sessionId:event.session_id,event:event.hook_event_name}),{mode:0o600});
 process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:"The classroom plugin SessionStart hook ran. Keep the reply concise."}}));
});
