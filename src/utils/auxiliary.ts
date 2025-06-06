export namespace Aux.object {
	/**
	 * Similar to Object.groupBy() polyfill (see CarbonicSoda/better-memo)
	 * but with single unqiue object for keys
	 */
	export function rekey<O extends { [key: string]: any }, V>(
		objs: O[],
		rekeyer: (obj: O, i: number) => V,
	): Map<V, O> {
		const rekeyed = new Map<V, O>();

		objs.forEach((obj, i) => rekeyed.set(rekeyer(obj, i), obj));

		return rekeyed;
	}
}

export namespace Aux.array {
	export function pin<T>(array: T[], ...pins: T[][]): T[] {
		for (const p of pins.reverse()) {
			array.sort((a, b) => +p.includes(b) - +p.includes(a));
		}

		return array;
	}
}

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
}
