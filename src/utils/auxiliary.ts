/**
 * Array related functions
 */
export namespace Aux.array {
	/**
	 * @returns copy of `array` with `items` removed (all duplicates of `items` are also removed)
	 */
	export function removeFrom<T>(array: T[], ...items: T[]): T[] {
		return array.filter((item) => !items.includes(item));
	}
}

/**
 * Object related functions
 */
export namespace Aux.object {
	/**
	 * Weakened implementation of Object.groupBy()
	 *
	 * @param grouper key of `objects` used for grouping
	 * @returns different values of object[`grouper`] as keys and corresponding objects as values
	 */
	export function group(
		objects: { [key: string]: any }[],
		grouper: keyof (typeof objects)[number],
	): { [group: string]: typeof objects } {
		const groups: { [group: keyof (typeof objects)[number]]: typeof objects } = {};
		for (const object of objects) groups[object[grouper]] = [];
		for (const object of objects) groups[object[grouper]].push(object);
		return groups;
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

	/**
	 * Sugar for Promise.all((await range(`n`)).map(`async (i) => {...}`))
	 */
	export async function range<T>(n: number, callback: (i: number) => Promise<T>): Promise<Awaited<T>[]> {
		return await map(Array(n).keys(), callback);
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
	export const plural = (countable: number | any[]) =>
		((<{ length?: number }>countable).length ?? countable) === 1 ? "" : "s";
}
