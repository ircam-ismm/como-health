import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/node.js';

import ComoClient from '@ircam/como/ComoClient.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

const OSC_PORT = 8001;

async function bootstrap() {
  const config = loadConfig(process.env.ENV, import.meta.url);
  const client = new Client(config);
  // https://soundworks.dev/tools/helpers.html#nodelauncher
  launcher.register(client);

  const como = new ComoClient(client);
  await como.start();

  const riot0SourceId = await como.sourceManager.createSource({
    type: 'riot',
    id: '0',
    port: OSC_PORT,
    verbose: false,
  });

  const riot1SourceId = await como.sourceManager.createSource({
    type: 'riot',
    id: '1',
    port: OSC_PORT,
    verbose: false,
  });

  const aggregatedSourceId = await como.sourceManager.createSource({
    type: 'aggregated',
    id: 'aggregate-riots',
    sources: [riot0SourceId, riot1SourceId],
  });

  const _playerId = await como.playerManager.createPlayer(aggregatedSourceId);
  // const _playerId2 = await como.playerManager.createPlayer(aggregatedSourceId);
}

// The launcher allows to launch multiple clients in the same terminal window
// e.g. `EMULATE=10 npm run watch thing` to run 10 clients side-by-side
launcher.execute(bootstrap, {
  numClients: process.env.EMULATE ? parseInt(process.env.EMULATE) : 1,
  moduleURL: import.meta.url,
});
