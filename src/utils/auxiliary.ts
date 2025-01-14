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
	export const plural = (countable: number | any[]) => {
		return ((<{ length?: number }>countable).length ?? countable) === 1 ? "" : "s";
	};

	export const capital = (word: string) => {
		return word[0].toUpperCase() + word.slice(1);
	};
}
