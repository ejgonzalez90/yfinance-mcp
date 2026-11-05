import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type ToolDef = {
  description: string;
  inputSchema: Record<string, z.ZodType>;
};
export type Handler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
}>;

/** Minimal McpServer stand-in that records registered tools. */
export function fakeServer() {
  const tools = new Map<string, { def: ToolDef; handler: Handler }>();
  const server = {
    registerTool(name: string, def: ToolDef, handler: Handler) {
      tools.set(name, { def, handler });
    },
  } as unknown as McpServer;
  return { server, tools };
}

/** Validate raw args against a tool's zod schema (applies defaults), then run it. */
export async function callTool(
  tools: ReturnType<typeof fakeServer>["tools"],
  name: string,
  args: Record<string, unknown>,
) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const parsed = z.object(tool.def.inputSchema).parse(args);
  return tool.handler(parsed);
}
