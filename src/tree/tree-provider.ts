import {
	Event,
	EventEmitter,
	MarkdownString,
	ThemeIcon,
	TreeDataProvider,
	workspace,
} from "vscode";

import {
	currentBranch,
	findMergeBase,
	findRoot,
	listBranches,
	log,
	readCommit,
	ReadCommitResult,
} from "isomorphic-git";

import { Aux } from "../utils/auxiliary";
import { Colors } from "../utils/colors";
import { fs } from "../utils/fs";
import { Md } from "../utils/md";
import { SyMap } from "../utils/symap";

import { TreeItem } from "./tree-item";

export class TreeProvider implements TreeDataProvider<TreeItem.ItemType> {
	private dataChangeEmitter: EventEmitter<void> = new EventEmitter<void>();

	onDidChangeTreeData: Event<void> = this.dataChangeEmitter.event;

	getTreeItem(element: TreeItem.ItemType) {
		return element;
	}

	getParent(element: TreeItem.ItemType) {
		return element.parent;
	}

	getChildren(element: undefined | TreeItem.ItemType) {
		if (element === undefined) return this.items;

		if ("children" in element) return element.children;

		return undefined;
	}

	items: TreeItem.PrimaryType[] = [];

	cwd: string | undefined;

	constructor() {
		this.cwd = workspace.workspaceFolders?.[0].uri.fsPath;
	}

	flush(): void {
		this.dataChangeEmitter.fire();
	}

	async refresh(
		cwd: typeof this.cwd = this.cwd,
		expand: {
			primary: boolean;
			secondary: boolean;
		},
	): Promise<void> {
		this.items = await this.getItems(cwd, expand);

		//MO TODO update context
		this.flush();
	}

	//MO TODO allow passing `changed` branches so as to prevent unnecessary recomputations
	private async getItems(
		cwd: typeof this.cwd,
		expand: {
			primary: boolean;
			secondary: boolean;
		},
	): Promise<typeof this.items> {
		if (!cwd) return [];

		const dir = await findRoot({ fs, filepath: cwd });

		const branches = await listBranches({ fs, dir });
		if (branches.length < 2) return [];

		Aux.array.pin(branches, ["main", "master"], ["dev", "develop"]);

		const cache = {};

		const headBranch = await currentBranch({ fs, dir });

		const lastCommits = new Map<string, ReadCommitResult>();
		for (const branch of branches) {
			const last = await log({ fs, dir, ref: branch, depth: 1, cache });

			lastCommits.set(branch, last[0]);
		}

		const mergeBases = new SyMap<string | undefined>();
		for (let i = 0; i < branches.length; i++) {
			for (let j = i + 1; j < branches.length; j++) {
				const branch1 = branches[i];
				const branch2 = branches[j];

				const last1 = lastCommits.get(branch1)!;
				const last2 = lastCommits.get(branch2)!;

				const bases: string[] = await findMergeBase({
					fs,
					dir,
					oids: [last1.oid, last2.oid],
					cache,
				});

				// criss-cross merges are ignored
				mergeBases.set(branch1, branch2, bases[0]);
			}
		}

		const diff = async (from: string, to: string) => {
			let dist = 0;

			while (from !== to) {
				const last = await log({ fs, dir, ref: to, depth: 2, cache });

				to = last[1].oid;
				dist++;
			}
			return dist;
		};
		const branchDiffs = new SyMap<number>();
		for (let i = 0; i < branches.length; i++) {
			for (let j = i + 1; j < branches.length; j++) {
				const branch1 = branches[i];
				const branch2 = branches[j];

				const mergeBase = mergeBases.get(branch1, branch2);
				if (!mergeBase) continue;

				const last1 = lastCommits.get(branch1)!;
				const last2 = lastCommits.get(branch2)!;

				const toBranch1 = await diff(mergeBase, last1.oid);
				const toBranch2 = await diff(mergeBase, last2.oid);

				branchDiffs.set(mergeBase, branch1, toBranch1);
				branchDiffs.set(mergeBase, branch2, toBranch2);
			}
		}

		const colors = {
			head: Colors.interpolate("00F"),
			merged: Colors.interpolate("#0F0"),
			unmerged: Colors.interpolate("#F00"),
		};

		const targetItems = branches.map((branch) => {
			const targetItem = new TreeItem.BranchItem<"primary">(
				branch,
				expand.primary,
				undefined,
			);

			const isHead = branch === headBranch;

			const icon = isHead ? "target" : "git-branch";
			const color = isHead ? colors.head : Colors.hash(branch);

			targetItem.iconPath = new ThemeIcon(icon, color);

			const last = lastCommits.get(branch)!;

			targetItem.tooltip = new MarkdownString(
				`#### $(${icon}) ${branch}\n\n---\n${Md.commit("Last Commit", last)}`,
				true,
			);

			return targetItem;
		});

		const branchItems = Aux.object.rekey(targetItems, (item) => item.branch);

		for (const targetItem of targetItems) {
			let unmerged = 0;

			for (const branch of branches) {
				if (targetItem.branch === branch) continue;

				const mergeBase = mergeBases.get(targetItem.branch, branch);
				if (!mergeBase) continue;

				const toBase = branchDiffs.get(mergeBase, branch)!;
				const toTarget = branchDiffs.get(mergeBase, targetItem.branch)!;

				const isMerged = toBase === 0;
				const isLatest = toTarget === 0;

				const baseItem = new TreeItem.BranchItem<"secondary">(
					branch,
					isMerged ? null : expand.secondary,
					targetItem,
				);
				targetItem.children.push(baseItem);

				baseItem.description = `${isMerged ? "" : `↑${toBase} `}${
					isLatest ? "" : `↓${toTarget}`
				}`;

				baseItem.tooltip = branchItems.get(branch)!.tooltip;

				baseItem.iconPath = isMerged
					? new ThemeIcon("check", colors.merged)
					: new ThemeIcon("x", colors.unmerged);

				if (isMerged) continue;
				unmerged++;

				const lastCommit = lastCommits.get(branch)!;
				const lastCommitItem = new TreeItem.CommitItem(
					"Last Commit",
					lastCommit,
					baseItem,
				);
				baseItem.children.push(lastCommitItem);

				const spreadItem = new TreeItem.Separator("", baseItem);
				baseItem.children.push(spreadItem);

				spreadItem.description = `${toBase} Commit${Aux.string.plural(
					toBase,
				)} Ahead Base`;

				const mergeBaseCommit = await readCommit({
					fs,
					dir,
					oid: mergeBase,
					cache,
				});
				const mergeBaseItem = new TreeItem.CommitItem(
					"Merge Base",
					mergeBaseCommit,
					baseItem,
				);
				baseItem.children.push(mergeBaseItem);
			}

			targetItem.description = unmerged === 0 ? "" : `\u00d7${unmerged}`;
		}

		return targetItems;
	}
}
