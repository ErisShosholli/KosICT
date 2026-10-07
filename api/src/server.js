import { openDatabase, seedDemo } from './db.js';
import { createApp } from './app.js';
const db = openDatabase();
if (process.env.DEMO_SEED === '1') seedDemo(db);
const server = createApp(db).listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => console.log('E-Depo API listening on port', server.address().port));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
