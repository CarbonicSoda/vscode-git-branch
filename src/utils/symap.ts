// other methods like has()/delete() could be implemented but not needed
// could be extended to n-keys easily if needed, refer to `key`
export class SyMap<V> {
	private map = new Map<string, V>();

	set(key1: string, key2: string, value: V): void {
		this.map.set(key(key1, key2), value);
	}

	get(key1: string, key2: string): V | undefined {
		return this.map.get(key(key1, key2));
	}
}

// could be used to normalize n-keys with .sort().map()
const key = (key1: string, key2: string) => {
	return key1 > key2
		? `${encodeURIComponent(key1)}|${encodeURIComponent(key2)}`
		: `${encodeURIComponent(key2)}|${encodeURIComponent(key1)}`;
};
