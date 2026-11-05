type Handler = (...args: any[]) => void;
interface Listener { handler: Handler; context: unknown; priority: number; }

/** BigHero NotificationBus contract (add/remove/changeListener/send) with string event ids and priority order. */
export class EventBus {
    private readonly listeners = new Map<string, Listener[]>();

    addListener(id: string, handler: Handler, context?: unknown, priority = 0): void {
        const list = this.listeners.get(id) ?? [];
        list.push({ handler, context, priority });
        list.sort((a, b) => b.priority - a.priority);
        this.listeners.set(id, list);
    }

    removeListener(id: string, handler: Handler, context?: unknown): void {
        const list = this.listeners.get(id);
        if (!list) return;
        this.listeners.set(id, list.filter(l => l.handler !== handler || l.context !== context));
    }

    /** Views call this from changeListener(enabled) so show/hide stay symmetric. */
    changeListener(enabled: boolean, id: string, handler: Handler, context?: unknown, priority = 0): void {
        if (enabled) this.addListener(id, handler, context, priority);
        else this.removeListener(id, handler, context);
    }

    send(id: string, ...args: unknown[]): void {
        const list = this.listeners.get(id);
        if (!list) return;
        for (const l of list.slice()) l.handler.apply(l.context, args);
    }
}
