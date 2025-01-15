import { Janitor } from "./utils/janitor";

import { BranchesTreeView } from "./tree-view";

export function activate(): void {
	BranchesTreeView.initView();
}

export function deactivate() {
	Janitor.cleanUp();
}
