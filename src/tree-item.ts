import { TreeItemCollapsibleState, TreeItem as VsTreeItem } from "vscode";

import { Branch } from "./utils/git";

export namespace TreeItem {
	export type PrimaryType = BranchItem<"primary">;

	export type SecondaryType = BranchItem<"secondary">;

	export type ItemType = PrimaryType | SecondaryType;

	class ExplorerItem<
		P extends undefined | ExplorerItem<undefined | ExplorerItem<undefined>>,
	> extends VsTreeItem {
		constructor(
			public label: string,

			expand: boolean | null,
			public parent: P,
		) {
			super(
				label,
				expand === null
					? TreeItemCollapsibleState.None
					: expand
					? TreeItemCollapsibleState.Expanded
					: TreeItemCollapsibleState.Collapsed,
			);
		}
	}

	export class BranchItem<
		T extends "primary" | "secondary",
	> extends ExplorerItem<
		T extends "primary" ? undefined : BranchItem<"primary">
	> {
		children: BranchItem<"secondary">[] = [];

		constructor(
			public branch: Branch,

			expand: boolean | null,
			parent: T extends "primary" ? undefined : BranchItem<"primary">,
		) {
			super(branch.name, expand, parent);

			this.contextValue = `${branch.type}Branch`;
		}
	}
}
