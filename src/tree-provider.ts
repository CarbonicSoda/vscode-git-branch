import {
	Event,
	EventEmitter,
	extensions,
	TreeDataProvider,
	workspace,
} from "vscode";

import { GitExtension, Repository } from "./declarations/git";

import { TreeItem } from "./tree-item";
import { Colors } from "./utils/colors";
import { Config } from "./utils/config";
import { GitRunner } from "./utils/git";

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

	repo: Repository;
	runner: GitRunner;

	constructor() {
		const gitExtension =
			extensions.getExtension<GitExtension>("vscode.git")!.exports;
		const gitExtensionApi = gitExtension.getAPI(1);

		const cwd = workspace.workspaceFolders![0]!.uri;
		this.repo = gitExtensionApi.getRepository(cwd) as Repository;

		this.runner = new GitRunner(this.repo);
	}

	flush(): void {
		this.dataChangeEmitter.fire();
	}

	async refresh(
		repo: Repository = this.repo,
		expand: {
			primary: boolean;
			secondary: boolean;
		},
	): Promise<void> {
		this.items = await this.getItems(repo, expand);

		//MO TODO update context
		this.flush();
	}

	private ColorPinned = Colors.interpolate("#FF0");
	private ColorMerged = Colors.interpolate("#0F0");
	private ColorUnmerged = Colors.interpolate("#F00");

	private async getItems(
		repo: Repository,
		expand: {
			primary: boolean;
			secondary: boolean;
		},
	): Promise<typeof this.items> {
		const includeRemotes = Config.get(
			"git-branch-master.includeRemotes",
		) as boolean;

		if (repo !== this.repo) this.runner = new GitRunner(repo);

		const branches = await this.runner.getBranches(
			// includeRemotes ? "all" : "local",
			"all"
		);
		console.log(branches)
		if (branches.length < 2) return [];

		return branches.map(
			(branch) => new TreeItem.BranchItem(branch, true, undefined),
		);
	}
}
