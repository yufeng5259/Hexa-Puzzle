import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PROJECT } from './io.mjs';
const creator=process.env.COCOS_CREATOR_ROOT||'G:/cocosCreator/Editor/Creator/3.8.8';
const tsc=path.join(creator,'resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js');
const result=spawnSync(process.execPath,[tsc,'--noEmit','--skipLibCheck','-p','tsconfig.json'],{cwd:PROJECT,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
