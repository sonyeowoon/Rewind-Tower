import { resolve } from 'node:path';
import { createStaticServer } from './static-server.mjs';
const project = resolve(import.meta.dirname, '..');
const root = process.argv.includes('--dist') ? resolve(project,'dist') : project;
const prefix = process.argv.find(arg=>arg.startsWith('--base='))?.slice(7) || '/';
const port = Number(process.env.PORT || 4173);
createStaticServer(root,prefix).listen(port,'127.0.0.1',()=>console.log(`Rewind Tower: http://localhost:${port}${prefix.endsWith('/')?prefix:prefix+'/'}`));
