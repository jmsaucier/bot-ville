import type { EventType, FarmEvent } from "@repo/shared";

type EventHandler = (event: FarmEvent) => void;

/**
 * In-process typed pub/sub event bus.
 * All farm system actions emit events through this bus.
 */
export class EventBus {
  private handlers = new Map<EventType, Set<EventHandler>>();
  private anyHandlers = new Set<EventHandler>();

  /** Subscribe to a specific event type */
  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** Subscribe to all events */
  onAny(handler: EventHandler): () => void {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  /** Emit an event to all matching subscribers */
  emit(event: FarmEvent): void {
    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        handler(event);
      }
    }

    // Notify wildcard handlers
    for (const handler of this.anyHandlers) {
      handler(event);
    }
  }

  /** Remove all handlers (useful for testing) */
  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}
