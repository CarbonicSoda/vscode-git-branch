import { Janitor } from "./utils/janitor";

export async function activate(): Promise<void> {}

export function deactivate() {
	Janitor.cleanUp();
}
