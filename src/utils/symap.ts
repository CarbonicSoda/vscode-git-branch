export class SyMap<V> {
	private map: Map<string, V> = new Map();

	set(key1: string, key2: string, value: V): void {
		this.map.set(key(key1, key2), value);
	}

	get(key1: string, key2: string): V | undefined {
		return this.map.get(key(key1, key2));
	}
}

const key = (key1: string, key2: string) => {
	return key1 > key2
		? `${encodeURIComponent(key1)}|${encodeURIComponent(key2)}`
		: `${encodeURIComponent(key2)}|${encodeURIComponent(key1)}`;
};
