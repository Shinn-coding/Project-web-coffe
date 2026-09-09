

// ponytail: in-process broadcaster — swap for Redis pub/sub only if the app
// is ever deployed with more than one Node instance.
type OrderStreamEvent = { id: string; orderNumber: number; status: string };
export const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

export function emitNewOrder(data: OrderStreamEvent) {
  const frame = `event: new-order\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(frame));
    } catch {
      clients.delete(controller);
    }
  }
}