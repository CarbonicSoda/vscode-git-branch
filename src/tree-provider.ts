import { accessSync, constants, watch } from "node:fs";
import {
	commands,
	Event,
	EventEmitter,
	extensions,
	MarkdownString,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
} from "vscode";

import { API as GitAPI, GitExtension, Repository } from "./declarations/git";

import { Aux } from "./utils/auxiliary";
import { ConfigMaid } from "./utils/config-maid";
import { GitRunner } from "./utils/git-runner";
import { VSColors } from "./utils/vs-colors";

import { TreeItems } from "./tree-items";
import { Janitor } from "./utils/janitor";

export namespace TreeProvider {
	//#region CONSTANTS
	export const VSCODE_GIT_API_VERSION = 1;
	//#endregion CONSTANTS

	/**
	 * Git Branches tree data provider
	 */
	export class Provider implements TreeDataProvider<TreeItems.BranchItem | TreeItems.CommitItem | TreeItem> {
		items: (TreeItems.BranchItem | TreeItems.CommitItem | TreeItem)[] = [];

		treeDataChangeEmitter: EventEmitter<void | undefined | TreeItems.BranchItem> = new EventEmitter<
			void | undefined | TreeItems.BranchItem
		>();
		onDidChangeTreeData: Event<void | undefined | TreeItems.BranchItem> = this.treeDataChangeEmitter.event;

		gitExtension: GitExtension;
		gitExtensionAPI: GitAPI;
		gitPath: string;

		gitRunner?: GitRunner;
		currRepo?: Repository;
		commitListener?: Janitor.Id;
		logListener?: Janitor.Id;

		get enabled(): boolean {
			return this.gitEnabled && this.currRepo !== undefined;
		}
		get gitEnabled(): boolean {
			return ConfigMaid.get("git.enabled");
		}

		get includeRemotes(): boolean {
			return <boolean>ConfigMaid.get("git-branch-master.includeRemotes");
		}
		get expandBranches(): boolean {
			return <boolean>ConfigMaid.get("git-branch-master.expandBranchesByDefault");
		}
		get expandUnmergedDetails(): boolean {
			return <boolean>ConfigMaid.get("git-branch-master.expandUnmergedDetailsByDefault");
		}
		get branchSortMethod(): "Commit Date" | "Alphabetic" {
			return <"Commit Date" | "Alphabetic">ConfigMaid.get("git-branch-master.defaultBranchesSortMethod");
		}
		get pinnedBranches(): string[] {
			return <string[]>ConfigMaid.get("git-branch-master.pinnedBranches");
		}

		async init(): Promise<void> {
			this.gitExtension = extensions.getExtension<GitExtension>("vscode.git").exports;
			this.gitExtensionAPI = this.gitExtension.getAPI(VSCODE_GIT_API_VERSION);
			this.gitPath = this.gitExtensionAPI.git.path;

			ConfigMaid.onChange("git", () => {
				if (this.gitEnabled) this.reload(this.currRepo);
				else {
					this.items = [];
					this.refresh();
				}
			});

			if (this.gitEnabled) await this.reload();
		}

		async reload(repo?: Repository): Promise<void> {
			commands.executeCommand("setContext", "git-branch-master.loaded", false);
			commands.executeCommand("setContext", "git-branch-master.noCommits", true);
			commands.executeCommand("setContext", "git-branch-master.noBranches", true);

			Janitor.clear(this.commitListener);
			Janitor.clear(this.logListener);

			if (repo) this.currRepo = repo;
			else if (!this.currRepo) {
				await new Promise<void>(async (res) => {
					const once = this.gitExtensionAPI.onDidOpenRepository((repo) => {
						this.currRepo = repo;
						if (!repo) return;
						once.dispose();
						res();
					});
					this.currRepo = await this.getPrimaryRepo();
					once.dispose();
					res();
				});
			}
			this.gitRunner = new GitRunner(this.gitPath, this.currRepo.rootUri.fsPath);

			if ((await this.gitRunner.getLatestHash()) === "None") {
				this.commitListener = Janitor.add(this.currRepo.onDidCommit(() => this.reload()));
				return;
			}
			commands.executeCommand("setContext", "git-branch-master.noCommits", false);

			const logsPath = `${this.currRepo.rootUri.fsPath}/.git/logs/HEAD`;
			while (true) {
				try {
					accessSync(logsPath, constants.R_OK);
					break;
				} catch {
					await new Promise((res) => setTimeout(res, 1000));
				}
			}
			this.logListener = Janitor.add(watch(logsPath, "buffer", () => this.reload()));
			await this.loadItems();
		}

		private async loadItems(): Promise<void> {
			this.items = await this.getItems();
			this.treeDataChangeEmitter.fire();
			commands.executeCommand("setContext", "git-branch-master.loaded", true);
		}

		/**
		 * @returns Primary repository of workspace or null if not found
		 */
		private async getPrimaryRepo(): Promise<Repository> {
			return await new Promise((res) => {
				const repo = this.gitExtensionAPI.repositories[0];
				if (repo) return res(repo);

				const once = this.gitExtensionAPI.onDidOpenRepository((repo) => {
					once.dispose();
					res(repo);
				});
			});
		}

		//#region Interface implementation methods

		getTreeItem(element: TreeItems.BranchItem): TreeItems.BranchItem {
			return element;
		}

		getParent(element: TreeItems.BranchItem): undefined | TreeItems.BranchItem {
			return element.parent;
		}

		getChildren(element: TreeItems.BranchItem | undefined): (TreeItems.BranchItem | TreeItem)[] {
			if (element) return element.children;
			return this.items;
		}

		//#endregion Interface implementation methods

		/**
		 * Updates provider items (does not reload items)
		 * @param item item to be updated, if not given the whole tree is refreshed
		 */
		refresh(item?: TreeItems.BranchItem): void {
			this.treeDataChangeEmitter.fire(item);
		}

		/**
		 * Retrieves updates and builds view items
		 * @returns built items (primary-hierarchy)
		 */
		private async getItems(): Promise<(TreeItems.BranchItem | TreeItem)[]> {
			//#region COLORS
			const PINNED_COLOR = VSColors.interpolate("#FF0");
			const MERGED_COLOR = VSColors.interpolate("#0F0");
			const UNMERGED_COLOR = VSColors.interpolate("#F00");
			//#endregion COLORS

			const branches = await this.gitRunner.getBranches(this.includeRemotes ? "all" : "local", {
				sort: this.branchSortMethod,
			});
			commands.executeCommand("setContext", "git-branch-master.singleBranch", branches.length < 2);
			if (branches.length < 2) return [];

			let localItems: TreeItems.BranchItem[] = [];
			const localCurrent: TreeItems.BranchItem[] = [];
			let remoteItems: TreeItems.BranchItem[] = [];
			const remoteCurrent: TreeItems.BranchItem[] = [];
			await Aux.async.map(branches, async (branch, i) => {
				const item = new TreeItems.BranchItem(branch, this.expandBranches ? "expand" : "collapse");

				const isPinned = this.pinnedBranches.includes(branch.name);
				const iconId = branch.isCurrent
					? "target"
					: branch.type === "local"
					? isPinned
						? "repo"
						: "git-branch"
					: isPinned
					? "github-inverted"
					: "github-alt";
				item.iconPath = new ThemeIcon(iconId, isPinned ? PINNED_COLOR : VSColors.hash(branch.id));

				item.latestHash = await this.gitRunner.getLatestHash(branch);
				const lastUpdated = await this.gitRunner.getUpdatedTime(branch, "local");
				item.tooltip = new MarkdownString(
					`$(${iconId}) ${Aux.string.capital(branch.type)} $(dash) ${branch.isCurrent ? "*" : ""}${
						branch.id
					}  \nLatest Commit __${item.latestHashShort}__  \nUpdated ${lastUpdated}`,
				);

				if (branch.isCurrent) {
					(branch.type === "local" ? localCurrent : remoteCurrent).push(item);
					return;
				}
				(branch.type === "local" ? localItems : remoteItems)[i] = item;
			});

			const pinned = this.pinnedBranches.reverse();
			[localItems, remoteItems] = [localItems, remoteItems].map((items) => {
				return items.flat().sort((a, b) => {
					return pinned.indexOf(b.branch.name) - pinned.indexOf(a.branch.name);
				});
			});

			const items: TreeItems.BranchItem[] = localCurrent.concat(localItems, remoteCurrent, remoteItems);
			commands.executeCommand("setContext", "git-branch-master.noBranches", items.length === 0);

			for (let i = 0; i < items.length; i++) {
				const self = items[i];
				const selfBranch = self.branch;

				let mergedItems: TreeItems.BranchItem[] = [];
				let unmergedItems: TreeItems.BranchItem[] = [];
				await Aux.async.map(items, async (other, j) => {
					if (i === j) return;
					const otherBranch = other.branch;

					const child = new TreeItems.BranchItem(otherBranch, "none", self);

					child.latestHash = items[j].latestHash;
					child.branchDiff = await this.gitRunner.getBranchDiff(otherBranch, selfBranch);
					const isMerged = child.branchDiff.fromCnt === 0;
					child.mergeBaseHash = isMerged
						? other.latestHash
						: await this.gitRunner.getMergeBaseHash(otherBranch, selfBranch);

					child.description = `${Aux.string.capital(otherBranch.type)} - ${
						isMerged ? `Merged` : "↓" + child.branchDiff.fromCnt
					} ↑${child.branchDiff.toCnt}`;
					child.tooltip = new MarkdownString(
						`${(<MarkdownString>other.tooltip).value}\n\n${
							isMerged ? `Fully Merged` : "From $(arrow-down) " + child.branchDiff.fromCnt
						} $(dash) To $(arrow-up) ${child.branchDiff.toCnt} ${
							isMerged ? "" : " $(dash) Sym $(arrow-swap) " + child.branchDiff.symCnt
						}  \nMerge Base __${child.mergeBaseHashShort}__`,
						true,
					);
					child.iconPath = isMerged
						? new ThemeIcon("check", MERGED_COLOR)
						: new ThemeIcon("x", UNMERGED_COLOR);

					(isMerged ? mergedItems : unmergedItems)[j] = child;
				});
				mergedItems = mergedItems.flat();
				unmergedItems = unmergedItems.flat();

				for (let j = 0; j < unmergedItems.length; j++) {
					const item = unmergedItems[j];

					const latestFromItem = new TreeItems.CommitItem(item.latestHash, item);
					latestFromItem.description = "^Latest";
					latestFromItem.tooltip = new MarkdownString(
						`Branch _${item.label}_\n\n\`\`\`\n* ${item.branchDiff.from.join("\n  ")}\n& ${
							item.mergeBaseHashShort
						}\n\`\`\``,
					);

					const spreadItem = new TreeItem("");
					spreadItem.description = `${item.branchDiff.fromCnt} Commit${Aux.string.plural(
						item.branchDiff.fromCnt,
					)} Ahead`;

					const mergeBaseItem = new TreeItems.CommitItem(item.mergeBaseHash, item);
					if (item.branchDiff.toCnt === 0) {
						mergeBaseItem.description = "Latest";
						mergeBaseItem.tooltip = "";
					} else {
						mergeBaseItem.description = `${item.branchDiff.toCnt} Commit${Aux.string.plural(
							item.branchDiff.toCnt,
						)} Ago`;
						mergeBaseItem.tooltip = new MarkdownString(
							`Branch _${item.parent.label}_\n\n\`\`\`\n* ${item.branchDiff.to.join("\n  ")}\n& ${
								item.mergeBaseHashShort
							}\n\`\`\``,
						);
					}

					item.collapsibleState = this.expandUnmergedDetails
						? TreeItemCollapsibleState.Expanded
						: TreeItemCollapsibleState.Collapsed;
					item.children = [
						latestFromItem,
						spreadItem,
						mergeBaseItem,
						...Aux.array.opt(j < unmergedItems.length - 1, TreeItems.SEP_ITEM),
					];
				}

				self.children = [].concat(
					mergedItems,
					unmergedItems,
					...Aux.array.opt(i < items.length - 1, TreeItems.SEP_ITEM),
				);

				self.fullyMerged = unmergedItems.length === 0;
				self.description =
					`${selfBranch.isCurrent ? "*" : ""}${Aux.string.capital(selfBranch.type)} - ` +
					(self.fullyMerged ? "Fully Merged" : `\u2713${mergedItems.length} \u00d7${unmergedItems.length}`);
				self.tooltip = new MarkdownString(
					`${(<MarkdownString>self.tooltip).value}\n\n` +
						(self.fullyMerged
							? "Fully Merged"
							: `Merged $(check) ${mergedItems.length} $(dash) Unmerged $(x) ${unmergedItems.length}`),
					true,
				);
			}

			return [].concat(
				localCurrent,
				localItems,
				...Aux.array.opt(
					localCurrent.length + localItems.length > 0 && remoteCurrent.length + remoteItems.length > 0,
					TreeItems.SEP_ITEM,
				),
				remoteCurrent,
				remoteItems,
			);
		}
	}
}
