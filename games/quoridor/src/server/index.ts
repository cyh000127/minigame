import { createHttpServer } from './http-server.js';
import { createSocketServer } from './socket-server.js';

function readPort(): number {
  const parsedPort = Number(process.env.PORT ?? '10002');

  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 10002;
}

const port = readPort();
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5174';
const httpServer = createHttpServer();

createSocketServer(httpServer, {
  clientOrigin
});

httpServer.listen(port, () => {
  console.log(`Quoridor server listening on http://localhost:${port}`);
});
