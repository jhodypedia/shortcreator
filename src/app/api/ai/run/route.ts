import { NextRequest } from "next/server";
import { AiRoleSchema } from "@/lib/ai/types";
import { runAiRole } from "@/lib/ai/runner";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { role?: unknown; input?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Body JSON tidak valid" }, { status: 400 }); }
  const role = AiRoleSchema.safeParse(body.role);
  if (!role.success) return Response.json({ error: "Peran AI tidak dikenal" }, { status: 400 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const result = await runAiRole(role.data, body.input, { onProgress: (progress) => send("progress", progress) });
        send("result", result);
      } catch (error) { send("error", { error: error instanceof Error ? error.message : String(error) }); }
      finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
