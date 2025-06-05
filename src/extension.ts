import { TreeView } from "./tree";
import { Janitor } from "./utils/janitor";

export function activate(): void {
	TreeView.init();
}

export function deactivate() {
	Janitor.cleanUp();
}
