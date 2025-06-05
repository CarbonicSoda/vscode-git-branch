import {
	Event,
	EventEmitter,
	MarkdownString,
	ThemeIcon,
	TreeDataProvider,
	workspace,
} from "vscode";

import {
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

	cwd: string;

	constructor() {
		this.cwd = workspace.workspaceFolders![0].uri.fsPath;
	}

	flush(): void {
		this.dataChangeEmitter.fire();
	}

	async refresh(
		cwd: string = this.cwd,
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
		cwd: string,
		expand: {
			primary: boolean;
			secondary: boolean;
		},
	): Promise<typeof this.items> {
		// const colors = {
		// 	head: Colors.interpolate("00F"),
		// 	merged: Colors.interpolate("#0F0"),
		// 	unmerged: Colors.interpolate("#F00"),
		// };

		const dir = await findRoot({ fs, filepath: cwd });

		const branches = await listBranches({ fs, dir });
		if (branches.length < 2) return [];

		const cache = {};

		const lastCommit: Map<string, ReadCommitResult> = new Map();
		for (const branch of branches) {
			const last = await log({ fs, dir, depth: 1, ref: branch });

			lastCommit.set(branch, last[0]);
		}

		const mergeBase: SyMap<string | undefined> = new SyMap();
		for (let i = 0; i < branches.length; i++) {
			for (let j = i + 1; j < branches.length; j++) {
				const branch1 = branches[i];
				const branch2 = branches[j];

				const oid1 = lastCommit.get(branch1)!.oid;
				const oid2 = lastCommit.get(branch2)!.oid;

				const base = (await findMergeBase({
					fs,
					dir,
					oids: [oid1, oid2],
					cache,
				})) as [string | undefined];

				mergeBase.set(branch1, branch2, base[0]);
			}
		}

		//MO TODO u know
		return [];
	}
}
