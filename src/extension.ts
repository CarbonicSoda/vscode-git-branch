import { Janitor } from "./utils/janitor";

import { TreeView } from "./tree-view";

export function activate(): void {
	TreeView.init();
}

export function deactivate() {
	Janitor.cleanUp();
}
