import { Janitor } from "./utils/janitor";

export function activate(): void {}

export function deactivate() {
	Janitor.cleanUp();
}
