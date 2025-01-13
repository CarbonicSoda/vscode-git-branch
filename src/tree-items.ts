import { TreeItem, TreeItemCollapsibleState } from "vscode";

export namespace TreeItems {
	export class Branch extends TreeItem {
		public children: Branch[] = [];

		constructor(name: string, expand: boolean | "none", public parent?: Branch) {
			let state: TreeItemCollapsibleState;
			if (expand === "none") state = TreeItemCollapsibleState.None;
			else state = expand ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;

			super(name, state);
		}
	}
}
