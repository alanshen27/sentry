import { getApiUser, Unauthorized } from "@/lib/auth/context";
import { getPresence, subscribePresence, type PresenceEvent } from "@/lib/realtime/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of presence for a project. On connect we replay a
 * snapshot of everyone currently online (sourced from Redis or the in-memory
 * fallback), then push live update/leave events as they happen.
 */
export async function GET(req: Request) {
  try {
    await getApiUser();
  } catch (e) {
    if (e instanceof Unauthorized) return new Response("unauthorized", { status: 401 });
    return new Response("error", { status: 500 });
  }

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return new Response("projectId required", { status: 400 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* closed */ }
      };

      // initial snapshot
      getPresence(projectId).then((list) => send({ type: "snapshot", presence: list })).catch(() => {});

      const unsub = subscribePresence(projectId, (evt: PresenceEvent) => send(evt));
      const ping = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch { /* closed */ }
      }, 25_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsub();
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
