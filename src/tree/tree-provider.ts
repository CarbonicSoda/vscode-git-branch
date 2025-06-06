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
	ReadCommitResult,
} from "isomorphic-git";
import { Aux } from "../utils/auxiliary";
import { Colors } from "../utils/colors";
import { fs } from "../utils/fs";
import { TreeItem } from "./tree-item";
import { SyMap } from "../utils/symap";
import { Format } from "../utils/format";

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

		const colors = {
			head: Colors.interpolate("00F"),
			merged: Colors.interpolate("#0F0"),
			unmerged: Colors.interpolate("#F00"),
		};

		const dir = await findRoot({ fs, filepath: cwd });

		const branches = await listBranches({ fs, dir });
		if (branches.length < 2) return [];

		Aux.array.pin(branches, ["main", "master"], ["dev", "develop"]);

		const cache = {};

		const headBranch = await currentBranch({ fs, dir });

		const lastCommits: Map<string, ReadCommitResult> = new Map();
		for (const branch of branches) {
			const commit = await log({ fs, dir, ref: branch, depth: 1, cache });

			lastCommits.set(branch, commit[0]);
		}

		const mergeBases: SyMap<string | undefined> = new SyMap();
		for (let i = 0; i < branches.length; i++) {
			for (let j = i + 1; j < branches.length; j++) {
				const branch1 = branches[i];
				const branch2 = branches[j];

				const oid1 = lastCommits.get(branch1)!.oid;
				const oid2 = lastCommits.get(branch2)!.oid;

				const bases: string[] = await findMergeBase({
					fs,
					dir,
					oids: [oid1, oid2],
					cache,
				});

				// criss-cross merges are ignored
				mergeBases.set(branch1, branch2, bases[0]);
			}
		}

		const targets = [];
		for (const branch of branches) {
			const target = new TreeItem.BranchItem<"primary">(
				branch,

				expand.primary,
				undefined,
			);

			const isHead = branch === headBranch;

			const icon = isHead ? "target" : "git-branch";
			const color = isHead ? colors.head : Colors.hash(branch);

			target.iconPath = new ThemeIcon(icon, color);

			const lastCommit = lastCommits.get(branch)!;

			target.tooltip = new MarkdownString(
				`#### $(${icon}) ${branch}\n\n---\n$(history) **Last Commit**  \n${
					lastCommit.oid
				}\n\n${
					lastCommit.commit.message
				}\n\n$(account) **Author**  \n${Format.contributor(
					lastCommit.commit.author,
				)}  \n$(account) **Committer**  \n${Format.contributor(
					lastCommit.commit.committer,
				)}`,
				true,
			);

			targets.push(target);
		}

		return targets;
	}
}
