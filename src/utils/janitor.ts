/**
 * Centrally manages disposable(-like)s and timeouts/intervals
 */
export namespace Janitor {
	/**
	 * Alias for number returned from Janitor for better context
	 */
	export type Id = number;

	/**
	 * Type with `dispose()` or `close()` function signature
	 */
	export type DisposableLike = {
		[any: string]: any;
		dispose(...args: any): any;
	};

	export let currentId = 0;
	export const managed: (DisposableLike | NodeJS.Timeout)[][] = [];

	/**
	 * @param disposableOrTimeout instances to manage
	 * @returns unique id for `DisposableOrTimeout`
	 */
	export function add(
		...disposableOrTimeout: (DisposableLike | NodeJS.Timeout)[]
	): Id {
		managed[currentId++] = disposableOrTimeout;
		return currentId;
	}

	/**
	 * Disposes/Clears the original managed instances with `id` and replaces it with `DisposableOrTimeout[]`
	 */
	export function override(
		id: Id,
		...disposableOrTimeout: (DisposableLike | NodeJS.Timeout)[]
	): void {
		clear(id);
		managed[id] = disposableOrTimeout;
	}

	/**
	 * Disposes/Clears the managed instances with `id`
	 */
	export function clear(id: Id): void {
		if (!managed[id] || managed[id].length === 0) return;

		for (const instance of managed[id]) {
			if ("dispose" in instance) {
				instance.dispose();
				continue;
			}
			clearTimeout(instance);
		}

		managed[id] = [];
	}

	/**
	 * Disposes/Clears all currently managed instances
	 */
	export function cleanUp(): void {
		for (let i = 0; i < currentId; i++) clear(i);
	}
}
