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
import { Aux } from "./utils/auxiliary";
import { Colors } from "./utils/colors";
import { Config } from "./utils/config";
import { Branch, GitRunner } from "./utils/git";

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
		const gitAPI = extensions
			.getExtension<GitExtension>("vscode.git")!
			.exports.getAPI(1);

		const cwd = workspace.workspaceFolders![0]!.uri;
		this.repo = gitAPI.getRepository(cwd) as Repository;

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

	private async getItems(
		repo: Repository,
		expand: {
			primary: boolean;
			secondary: boolean;
		},
	): Promise<typeof this.items> {
		const pinnedBranches = Config.get(
			"git-branch-master.pinnedBranches",
		) as string[];

		const colorHead = Colors.interpolate("00F");
		const colorMerged = Colors.interpolate("#0F0");
		const colorUnmerged = Colors.interpolate("#F00");

		this.runner = new GitRunner(repo);

		let branches = await this.runner.getBranches();
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
			const iconColor = branch.head ? colorHead : Colors.hash(branch.name);
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

		const cache: {
			[key: string]: {
				branchDiff: {
					fm: string[];
					to: string[];
				};
				mergeBase: string;
			};
		} = {};

		for (const primary of primaries) {
			await Aux.async.map(branches, async (branch) => {
				if (primary.branch.ref === branch.ref) return;
				const branchItem = branchItems.get(branch.ref)![0];

				const key1 = `${branch.ref}*${primary.branch.ref}`;
				const key2 = `${primary.branch.ref}*${branch.ref}`;

				const cached = cache[key1] ?? cache[key2];

				if (!cached) {
					const branchDiff = await this.runner.getBranchDiff(
						branch,
						primary.branch,
					);
					const isMerged = branchDiff.to.length === 0;

					const mergeBase = isMerged
						? ""
						: await this.runner.getMergeBase(branch, primary.branch);

					cache[key1] = { branchDiff, mergeBase };
				}

				const { branchDiff, mergeBase } = cache[key1] ?? {
					branchDiff: {
						fm: cache[key2].branchDiff.to,
						to: cache[key2].branchDiff.fm,
					},
					mergeBase: cache[key2].mergeBase,
				};

				const isMerged = branchDiff.to.length === 0;
				const isLatest = branchDiff.fm.length === 0;

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
						isMerged ? "" : `$(arrow-up) ${branchDiff.to.length}`
					}${isMerged || isLatest ? "" : " $(dash) "}${
						isLatest ? "" : `$(arrow-down) ${branchDiff.fm.length}`
					}${
						isMerged && isLatest
							? ""
							: `  \nMerge Base ${mergeBase.slice(0, 7)}\n\n---\n`
					}${(branchItem.tooltip as MarkdownString).value}`,
					true,
				);

				secondary.iconPath = isMerged
					? new ThemeIcon("check", colorMerged)
					: new ThemeIcon("x", colorUnmerged);

				if (isMerged) return;

				const lastCommit = branchDiff.to[0];
				const lastCommitItem = new TreeItem.CommitItem(lastCommit, secondary);
				secondary.children.push(lastCommitItem);

				lastCommitItem.description = "Last";

				lastCommitItem.tooltip = await this.runner.getCommitMd(
					lastCommit,
					"Last",
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

				mergeBaseItem.description = "Base";

				mergeBaseItem.tooltip = isMerged
					? "A root commit is N/A"
					: await this.runner.getCommitMd(mergeBase, "Base");
			});
		}

		return primaries;
	}
}
