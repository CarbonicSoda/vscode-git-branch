import {
	Event,
	EventEmitter,
	extensions,
	MarkdownString,
	ThemeIcon,
	TreeDataProvider,
	workspace,
} from "vscode";

import { GitExtension, Repository } from "./declarations/git";

import { TreeItem } from "./tree-item";
import { Colors } from "./utils/colors";
import { Config } from "./utils/config";
import { Branch, GitRunner } from "./utils/git";
import { Aux } from "./utils/auxiliary";

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

	private ColorHead = Colors.interpolate("00F");
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
		const pinnedBranches = Config.get(
			"git-branch-master.pinnedBranches",
		) as string[];

		this.runner = new GitRunner(repo);

		let branches = await this.runner.getBranches(
			includeRemotes ? "all" : "local",
		);
		if (branches.length < 2) return [];

		const groups = Aux.object.group(branches, (branch) => branch.type);

		const pinned = (branch: Branch) => pinnedBranches.includes(branch.name);

		const localPinned = Aux.array.pin(groups.get("local")!, pinned);
		const remotePinned = Aux.array.pin(groups.get("remote") ?? [], pinned);
		branches = localPinned.concat(remotePinned);

		const primaries = await Aux.async.map(branches, async (branch) => {
			const primary = new TreeItem.BranchItem<"primary">(
				branch,
				expand.primary,
				undefined,
			);

			const isPinned = pinned(branch);

			const iconId = branch.head
				? "target"
				: isPinned
				? branch.type === "local"
					? "repo"
					: "github-inverted"
				: branch.type === "local"
				? "git-branch"
				: "github-alt";
			const iconColor = branch.head ? this.ColorHead : Colors.hash(branch.name);
			primary.iconPath = new ThemeIcon(iconId, iconColor);

			const lastCommit = await this.runner.getLastCommit(branch);
			const lastUpdated = await this.runner.getLastUpdated(branch);

			primary.tooltip = new MarkdownString(
				`$(${iconId}) ${branch.type} $(dash) **${
					branch.name
				}**  \nLast Commit ${lastCommit.slice(0, 7)}  \n${lastUpdated}`,
				true,
			);

			return primary;
		});

		const branchItems = Aux.object.group(primaries, (item) => item.branch.ref);

		for (const primary of primaries) {
			await Aux.async.map(branches, async (branch) => {
				if (primary.branch.ref === branch.ref) return;
				const branchItem = branchItems.get(branch.ref)![0];

				const branchDiff = await this.runner.getBranchDiff(
					branch,
					primary.branch,
				);

				const isMerged = branchDiff.to.length === 0;

				const mergeBase = isMerged
					? ""
					: await this.runner.getMergeBase(primary.branch, branch);

				const secondary = new TreeItem.BranchItem<"secondary">(
					branch,
					!isMerged || null,
					primary,
				);
				primary.children.push(secondary);

				secondary.description = `${Aux.string.formal(branch.type)} ${
					isMerged ? "" : `↑${branchDiff.to.length} `
				}↓${branchDiff.fm.length}`;

				secondary.tooltip = new MarkdownString(
					`${(primary.tooltip as MarkdownString).value}\n\n---\n${
						isMerged ? "" : `$(arrow-up) ${branchDiff.to.length} $(dash) `
					}$(arrow-down) ${branchDiff.fm.length}${
						isMerged ? "" : `  \nMerge Base ${mergeBase.slice(0, 7)}`
					}\n\n---\n${(branchItem.tooltip as MarkdownString).value}`,
					true,
				);

				secondary.iconPath = isMerged
					? new ThemeIcon("check", this.ColorMerged)
					: new ThemeIcon("x", this.ColorUnmerged);

				if (isMerged) return;

				const lastCommit = branchDiff.to[0];
				const lastCommitItem = new TreeItem.CommitItem(lastCommit, secondary);
				secondary.children.push(lastCommitItem);

				lastCommitItem.tooltip = new MarkdownString(
					await this.runner.run(
						"log",
						"-1",
						"--format=$(history) %h  %n%ad%n%n---%n%B",
						"--date=format-local:%m/%d/%Y %a %H:%M",
						lastCommit,
					),
					true,
				);

				const spreadItem = new TreeItem.Separator("", secondary);
				secondary.children.push(spreadItem);

				spreadItem.description = `${
					branchDiff.to.length
				} Commit${Aux.string.plural(branchDiff.to)} Ahead`;

				const mergeBaseItem = isMerged
					? new TreeItem.Separator("N/A", secondary)
					: new TreeItem.CommitItem(mergeBase, secondary);
				secondary.children.push(mergeBaseItem);

				mergeBaseItem.tooltip = isMerged
					? "A root commit is N/A"
					: new MarkdownString(
							await this.runner.run(
								"log",
								"-1",
								"--format=$(history) %h  %n%ad%n%n---%n%B",
								"--date=format-local:%m/%d/%Y %a %H:%M",
								mergeBase,
							),
							true,
					  );
			});
		}

		return primaries;
	}
}
