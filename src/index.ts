#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import schema from "./schema/schema.json" with { type: "json" };

const server = new FastMCP({
  name: "mcp-spec-server",
  version: "0.0.2",
});

server.addPrompt({
  name: "mcp-spec-latest",
  description: "Provides the complete Model Context Protocol JSON schema specification (2025-03-26) for reference",
  load: async () => JSON.stringify(schema)
});

// Handle process signals for clean shutdown
process.on("SIGINT", () => {
  process.exit(0);
});

server.start({
  transportType: "stdio"
});
