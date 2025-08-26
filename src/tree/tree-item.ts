/* eslint-disable @typescript-eslint/no-namespace */
import { Commit } from "neogit";
import { env, MarkdownString, TreeItemCollapsibleState, TreeItem as VSTreeItem } from "vscode";
import { Md } from "../utils/md";

export namespace TreeItem {
	export type PrimaryType = BranchItem<"primary">;

	export type SecondaryType = BranchItem<"secondary">;

	export type InnerType = PrimaryType | SecondaryType;

	export type LeafType = CommitItem | Separator;

	export type ItemType = InnerType | LeafType;

	class ExplorerItem<
		P extends undefined | ExplorerItem<undefined | ExplorerItem<undefined>>,
	> extends VSTreeItem {
		constructor(public label: string, expand: boolean | null, public parent: P) {
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

	export class BranchItem<T extends "primary" | "secondary"> extends ExplorerItem<
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
			arguments: [async () => await env.clipboard.writeText(this.commit.hash)],
		};

		constructor(name: string, public commit: Commit, parent: BranchItem<"secondary">) {
			super(commit.hash.slice(0, 7), null, parent);

			this.tooltip = new MarkdownString(
				`${Md.commit(name, commit)}\n\n---\nClick to Copy Full Hash`,
				true,
			);
		}
	}

	export class Separator extends ExplorerItem<BranchItem<"secondary">> {
		constructor(public label: string, parent: BranchItem<"secondary">) {
			super(label, null, parent);
		}
	}
}
