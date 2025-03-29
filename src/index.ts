import { FastMCP } from "fastmcp";
import * as fs from "node:fs";
import * as path from "node:path";

const server = new FastMCP({
  name: "mcp-spec-server",
  version: "0.0.1",
});

server.addPrompt({
  name: "mcp-spec-latest",
  description: "Provides the complete Model Context Protocol JSON schema specification (2025-03-26) for reference",
  load: async () => {
    const schemaPath = path.join(process.cwd(), "spec/schema.json");
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    return JSON.stringify(schema);
  }
});

// Handle process signals for clean shutdown
process.on("SIGINT", () => {
  process.exit(0);
});

server.start({
  transportType: "stdio"
});
