import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { attachGameServer } from './lib/server/wss';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const server = createServer((req, res) => {
    handle(req, res, parse(req.url ?? '/', true));
  });

  // Oyun WebSocket'i ayni HTTP sunucusunda /ws yolunda yasar.
  // Tek surec oldugu icin oda defteri de burada, bellekte.
  attachGameServer(server);

  server.listen(port, hostname, () => {
    console.log(`Bütçe Savaşları hazır: http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error('Sunucu başlatılamadı:', error);
  process.exit(1);
});
