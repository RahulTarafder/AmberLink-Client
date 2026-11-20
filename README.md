# AmberLink Client

[![npm version](https://img.shields.io/npm/v/amberlink-client)](https://www.npmjs.com/package/amberlink-client)
[![npm downloads](https://img.shields.io/npm/dm/amberlink-client)](https://www.npmjs.com/package/amberlink-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**AmberLink Client** is a TypeScript/JavaScript client for managing AmberLink audio servers and compatible node implementations. It provides node management, players, queues, filters, lyrics utilities, and related types through a single package.


## Requirements

- Node.js **18 or newer**, or Bun **1.1.27 or newer**.
- An AmberLink server or compatible node you can connect to.
- A Discord bot/application and a Discord library for handling voice connections and forwarding voice payloads.

AmberLink Client does not replace your Discord library's voice connection implementation. You must connect the bot to voice and implement the `sendToShard` callback for your Discord library.


## Install

```bash
npm install amberlink-client
```


## Quick start

This minimal setup initializes the manager. The voice-payload callback is deliberately left as an integration point because its implementation differs between Discord libraries.

```ts
import { AmberLinkManager, NodeType } from "amberlink-client";

const clientId = process.env.DISCORD_CLIENT_ID;
const password = process.env.AMBERLINK_PASSWORD;

if (!clientId || !password) {
  throw new Error("Set DISCORD_CLIENT_ID and AMBERLINK_PASSWORD first.");
}


const manager = new AmberLinkManager({
  nodes: [
    {
      id: "amber-primary",
      host: process.env.AMBERLINK_HOST ?? "127.0.0.1",
      port: Number(process.env.AMBERLINK_PORT ?? 2333),
      authorization: password,
      nodeType: NodeType.AmberLink,
    },
  ],
  client: { id: clientId, username: "MyBot" },
  sendToShard: (guildId, payload) => {
    // Forward payload to your Discord library's voice/shard API.
    // Never log voice payloads or tokens.
    void guildId;
    void payload;
  },
});


await manager.init({ id: clientId });
```


## Configuration

| Property | Description |
| --- | --- |
| `nodes` | Node configurations supplied to the manager. |
| `nodes[].id` | Optional node identifier. |
| `nodes[].host` | Hostname or IP address of the node. |
| `nodes[].port` | Node websocket port. |
| `nodes[].authorization` | Shared secret configured on the server. |
| `nodes[].nodeType` | Node protocol, selected using `NodeType`. |
| `client.id` | Discord application/client ID. |
| `client.username` | Client username reported to the server. |
| `sendToShard` | Callback for forwarding Discord voice payloads using your Discord library. |


## Node types

The package exports `NodeType` with these documented options:

- `NodeType.AmberLink` — AmberLink protocol/server.
- `NodeType.ThirdPartyNode` — compatible third-party node.
- `NodeType.NodeLink` — NodeLink protocol implementation.

Use the node type that matches the server you are connecting to. Protocol support and feature availability may differ by node.


## Features

- Manager and node lifecycle management
- AmberLink and NodeLink node implementations
- Player management and track handling
- Queue utilities and queue persistence interfaces
- Audio filter management
- Lyrics timeline normalization and synchronization helpers
- TypeScript public types and utility exports


## Examples

- [`examples/amberlink-client/`](./examples) — client initialization example.


## Development

Clone the repository and install development dependencies:


```bash
git clone https://github.com/RahulTarafder/AmberLink-Client.git
cd AmberLink-Client
npm install
```

Run checks:

```bash
npm run typecheck
npm test
npm run lint
```

Available scripts:

| Script | Purpose |
| --- | --- |
| `npm run build` | Build package output into `dist/`. |
| `npm run typecheck` | Run TypeScript type checking without emitting files. |
| `npm test` | Build and run the Node.js test suite. |
| `npm run lint` | Lint project files. |
| `npm run lint:fix` | Apply supported lint fixes. |
| `npm run fmt` | Format project files. |

Tests currently focus on lyrics timeline parsing, normalization, timing boundaries, and legacy input compatibility. They are not a substitute for testing against a running audio node and Discord voice connection.


## Contributing

Issues, bug reports, documentation improvements, and pull requests are welcome. Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before submitting changes.


## Author

**Rahul Tarafder** — [GitHub profile](https://github.com/RahulTarafder)


## Contributors

Thanks to everyone who contributes issues, code, documentation, testing, and feedback. Contributors are recognized through the repository's contribution history. To contribute, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).


## License

Released under the **MIT License**. See [`LICENSE`](./LICENSE) for details.
