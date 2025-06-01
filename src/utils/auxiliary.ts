//MO TODO cleanup

import { Event } from "vscode";

export namespace Aux.object {
	/**
	 * Similar to Object.groupBy()
	 *
	 * @param grouper callback for group keys
	 * @returns ``grouper(obj)` as keys and corresponding objects as values
	 */
	export function group<O extends { [key: string]: any }, V>(
		objs: O[],
		grouper: (obj: O, i: number) => V,
	): Map<V, O[]> {
		const groups: Map<V, O[]> = new Map();

		objs.forEach((obj, i) => {
			const group =
				typeof grouper === "function"
					? grouper(obj, i)
					: obj[grouper as keyof O];

			if (!groups.has(group)) groups.set(group, []);
			groups.get(group)!.push(obj);
		});

		return groups;
	}
}

export namespace Aux.array {
	export function pin<T>(array: T[], pin: (item: T) => boolean): T[] {
		return array.sort((a, b) => {
			return +pin(b) - +pin(a);
		});
	}
}

/**
 * Asynchronous operation functions
 */
export namespace Aux.async {
	/**
	 * Sugar for Promise.all(`iterable`.map(`async (ele) => {...}`))
	 */
	export async function map<T, C>(
		iterable: Iterable<T>,
		callback: (value: T, index: number, array: T[]) => Promise<C>,
	): Promise<Awaited<C>[]> {
		return await Promise.all([...iterable].map(callback));
	}
}

/**
 * String related functions
 */
export namespace Aux.string {
	/**
	 * @param countable number or object with `.length` property
	 * @returns "s" if countable is plural or else ""
	 */
	export const plural = (countable: number | any[]) => {
		return (typeof countable === "number" ? countable : countable.length) === 1
			? ""
			: "s";
	};

	export const formal = (word: string) => {
		return word[0].toUpperCase() + word.slice(1);
	};
}

export namespace Aux.event {
	export async function wait(listen: Event<any>): Promise<void> {
		return await new Promise((res) => {
			const disposable = listen(() => {
				res();
				disposable.dispose();
			});
		});
	}
}
