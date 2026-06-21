/**
 * The contract every route (the chooser + each world) implements so the shell can mount and
 * unmount them uniformly.
 *
 * A factory is handed the **already-attached** host (`#app`); it builds its own root, appends it to
 * the host, starts whatever it needs (a render loop, listeners), and returns a {@link View} whose
 * `destroy()` reverses all of that. Attaching before the factory runs matters: the mounts size their
 * canvas from `host.clientWidth/Height`, which is `0` while detached.
 */
export interface View {
	/** Stop loops, remove every listener this view added, and detach its DOM. Idempotent. */
	destroy(): void;
}

/** Builds a route's view into the given (attached) host. */
export type ViewFactory = (host: HTMLElement) => View;
