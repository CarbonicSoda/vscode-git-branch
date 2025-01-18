import { TreeItem, TreeItemCollapsibleState } from "vscode";

import { Branch } from "./utils/git-runner";

export namespace TreeItems {
	export const SEP_ITEM = new TreeItem("", TreeItemCollapsibleState.None);

	export class BranchItem extends TreeItem {
		contextValue = "Branch";
		children: (BranchItem | TreeItem)[] = [];

		type: "local" | "remote";
		fullyMerged: boolean;
		latestHash: string;
		mergeBaseHash: string;
		branchDiff: {
			from: string[];
			fromCnt: number;
			to: string[];
			toCnt: number;
			sym: string[];
			symCnt: number;
		};

		get latestHashShort(): string {
			return this.latestHash.slice(0, 7);
		}
		get mergeBaseHashShort(): string {
			return this.mergeBaseHash.slice(0, 7);
		}

		constructor(public branch: Branch, expand: "expand" | "collapse" | "none", public parent?: BranchItem) {
			const state = {
				expand: TreeItemCollapsibleState.Expanded,
				collapse: TreeItemCollapsibleState.Collapsed,
				none: TreeItemCollapsibleState.None,
			}[expand];
			super(branch.id, state);
			this.type = branch.type;
		}
	}

	export class CommitItem extends TreeItem {
		contextValue = "Commit";

		constructor(public hash: string) {
			super({
				label: hash.slice(0, 7),
				highlights: [[0, 7]],
			});
		}
	}
}
