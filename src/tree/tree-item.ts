import { env, TreeItemCollapsibleState, TreeItem as VSTreeItem } from "vscode";

export namespace TreeItem {
	export type PrimaryType = BranchItem<"primary">;

	export type SecondaryType = BranchItem<"secondary">;

	export type InnerType = PrimaryType | SecondaryType;

	export type LeafType = CommitItem | Separator;

	export type ItemType = InnerType | LeafType;

	class ExplorerItem<
		P extends undefined | ExplorerItem<undefined | ExplorerItem<undefined>>,
	> extends VSTreeItem {
		constructor(public text: string, expand: boolean | null, public parent: P) {
			super(
				text,
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
		contextValue = "branch";

		children: (T extends "primary" ? BranchItem<"secondary"> : LeafType)[] = [];

		constructor(
			public branch: string,
			expand: boolean | null,
			parent: T extends "primary" ? undefined : BranchItem<"primary">,
		) {
			super(branch, expand, parent);
		}
	}

	export class CommitItem extends ExplorerItem<BranchItem<"secondary">> {
		command = {
			title: "Copy Full Hash",
			command: "git-branch-master.copyFullHash",
			arguments: [async () => await env.clipboard.writeText(this.hash)],
		};
		tooltip = "Copy Full Hash";

		constructor(public hash: string, parent: BranchItem<"secondary">) {
			super(hash.slice(0, 7), null, parent);
		}
	}

	export class Separator extends ExplorerItem<BranchItem<"secondary">> {
		constructor(public text: string, parent: BranchItem<"secondary">) {
			super(text, null, parent);
		}
	}
}
