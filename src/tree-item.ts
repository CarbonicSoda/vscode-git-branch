import { TreeItemCollapsibleState, TreeItem as VSTreeItem } from "vscode";

import { Branch } from "./utils/git";

export namespace TreeItem {
	export type PrimaryType = BranchItem<"primary">;

	export type SecondaryType = BranchItem<"secondary">;

	export type InnerType = PrimaryType | SecondaryType;

	export type LeafType = CommitItem | Separator;

	export type ItemType = InnerType | LeafType;

	class ExplorerItem<
		P extends undefined | ExplorerItem<undefined | ExplorerItem<undefined>>,
	> extends VSTreeItem {
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
		children: (T extends "primary" ? BranchItem<"secondary"> : LeafType)[] = [];

		constructor(
			public branch: Branch,

			expand: boolean | null,
			parent: T extends "primary" ? undefined : BranchItem<"primary">,
		) {
			super(branch.name, expand, parent);

			this.contextValue = `${branch.type}Branch`;
		}
	}

	export class CommitItem extends ExplorerItem<BranchItem<"secondary">> {
		constructor(public hash: string, parent: BranchItem<"secondary">) {
			super(hash.slice(0, 7), null, parent);
		}
	}

	export class Separator extends ExplorerItem<BranchItem<"secondary">> {
		constructor(public label: string, parent: BranchItem<"secondary">) {
			super(label, null, parent);
		}
	}
}
