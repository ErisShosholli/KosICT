import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const pythonPath = resolve(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
if (!existsSync(pythonPath)) { console.error('Run the Python setup in README.md first.'); process.exit(1); }
const children = [];
let stopping = false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),300).unref();}
for(const [command,args,extra] of [
 [process.execPath,['api/src/server.js'],{DEMO_SEED:process.env.DEMO_SEED || '1'}],
 [pythonPath,['-m','uvicorn','service:app','--app-dir','ingestion','--host','127.0.0.1','--port','8000'],{}],
 [process.execPath,['node_modules/vite/bin/vite.js','--config','web/vite.config.js','web','--port','5173','--strictPort'],{}]
]){const child=spawn(command,args,{stdio:'inherit',env:{...process.env,...extra}});children.push(child);child.on('error',error=>{console.error(error.message);stop(1)});child.on('exit',(code,signal)=>{if(!stopping){console.error('Demo process exited:',code,signal);stop(code || 1)}});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
