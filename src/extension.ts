import { Janitor } from "./utils/janitor";

import { BranchesTreeView } from "./tree-view";

export function activate(): void {
	BranchesTreeView.init();
}

export function deactivate() {
	Janitor.cleanUp();
}
