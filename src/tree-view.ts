import {
	TreeDataProvider,
	EventEmitter,
	Event,
	extensions,
	window,
	TreeView,
	TreeItem,
	TreeItemCollapsibleState,
	ThemeIcon,
	MarkdownString,
	commands,
} from "vscode";
import { API as GitAPI, GitExtension, Repository } from "./declarations/git";

import { Aux } from "./utils/auxiliary";
import { Janitor } from "./utils/janitor";
import { ConfigMaid } from "./utils/config-maid";
import { VSColors } from "./utils/vs-colors";
import { Branch, GitRunner } from "./utils/git-runner";

/**
 * Provides Git Branches view on primary sidebar, main presentation module
 */
export namespace GitBranchesTreeView {
	//#region CONSTANTS
	const VSCODE_GIT_API_VERSION = 1;

	const TIMEOUT_GET_REPO = 10;

	const SEPARATOR_ITEM = new TreeItem("", TreeItemCollapsibleState.None);
	//#endregion CONSTANTS

	/**
	 * Tree item class for a git branch
	 */
	class BranchItem extends TreeItem {
		type: "local" | "remote" | "detached";

		children: BranchItem[] = [];

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

	/**
	 * Git Branches tree data provider
	 */
	class Provider implements TreeDataProvider<BranchItem | typeof SEPARATOR_ITEM> {
		items: (BranchItem | typeof SEPARATOR_ITEM)[] = [];

		treeDataChangeEmitter: EventEmitter<void | undefined | BranchItem> = new EventEmitter<
			void | undefined | BranchItem
		>();
		onDidChangeTreeData: Event<void | undefined | BranchItem> = this.treeDataChangeEmitter.event;

		gitExtension: GitExtension;

		gitExtensionAPI?: GitAPI;
		gitPath?: string;
		gitRunner?: GitRunner;

		currRepo?: Repository;
		repoListener?: number;

		get enabled(): boolean {
			return this.gitEnabled && this.currRepo !== undefined;
		}
		get gitEnabled(): boolean {
			return ConfigMaid.get("git.enabled");
		}

		async initProvider(): Promise<void> {
			this.gitExtension = await extensions.getExtension<GitExtension>("vscode.git").activate();

			ConfigMaid.onChange("git", () => {
				Janitor.clear(this.repoListener);
				if (this.gitEnabled) this.updateGitAPI();
				else {
					this.items = [];
					this.refresh();
					this.gitExtensionAPI = this.gitPath = this.gitRunner = this.currRepo = undefined;
				}
			});

			if (this.gitEnabled) await this.updateGitAPI();
		}

		async updateGitAPI(): Promise<void> {
			if (!this.gitExtension.enabled) {
				await new Promise<void>((res) => {
					const once = this.gitExtension.onDidChangeEnablement(() => {
						once.dispose();
						res();
					});
				});
			}
			this.gitExtensionAPI = this.gitExtension.getAPI(VSCODE_GIT_API_VERSION);
			this.gitPath = this.gitExtensionAPI.git.path;

			this.repoListener = Janitor.add(
				this.gitExtensionAPI.onDidOpenRepository((repo) => {
					if (this.currRepo) return;
					this.currRepo = repo;
					this.updateGitRunner();
				}),
			);
			this.currRepo = await this.getPrimaryRepo();
			if (this.currRepo) await this.updateGitRunner();
		}

		async updateGitRunner(): Promise<void> {
			this.gitRunner = new GitRunner(this.gitPath, this.currRepo.rootUri.fsPath);
			await this.reloadItems();
		}

		/**
		 * Resolves after {@link TIMEOUT_GET_REPO} seconds if primary repo cant be found
		 * @returns Primary repository of workspace or null if not found
		 */
		async getPrimaryRepo(): Promise<Repository | undefined> {
			return await new Promise((res) => {
				const repo = this.gitExtensionAPI.repositories[0];
				if (repo) return res(repo);

				const once = this.gitExtensionAPI.onDidOpenRepository((repo) => {
					clearTimeout(timeout);
					once.dispose();
					res(repo);
				});
				const timeout = setTimeout(() => {
					once.dispose();
					res(undefined);
				}, TIMEOUT_GET_REPO * 1000);
			});
		}

		//#region Interface implementation methods

		getTreeItem(element: BranchItem): BranchItem {
			return element;
		}

		getParent(element: BranchItem): undefined | BranchItem {
			return element.parent;
		}

		getChildren(element: BranchItem | undefined): (BranchItem | typeof SEPARATOR_ITEM)[] {
			if (element) return element.children;
			return this.items;
		}

		//#endregion End of interface implementation methods

		/**
		 * Updates provider items (does not reload items)
		 * @param item item to be updated, if not given the whole tree is refreshed
		 */
		refresh(item?: BranchItem): void {
			this.treeDataChangeEmitter.fire(item);
		}

		/**
		 * Reloads provider with updated items
		 */
		async reloadItems(): Promise<void> {
			if (!this.enabled) return;
			this.items = await this.getItems();
			this.treeDataChangeEmitter.fire();
		}

		/**
		 * Retrieves updates and builds view items
		 * @returns built items (primary-hierarchy)
		 */
		private async getItems(): Promise<(BranchItem | typeof SEPARATOR_ITEM)[]> {
			//#region CONFIGS
			const includeRemoteBranches = <boolean>ConfigMaid.get("git-branches.view.includeRemoteBranches");

			const branchesSortMethod =
				<"Commit Date" | "Alphabetic">ConfigMaid.get("git-branches.view.branchesSortMethod") === "Commit Date"
					? "date"
					: "alphabet";

			const pinnedBranches = (<string[]>ConfigMaid.get("git-branches.view.pinnedBranches")).reverse();

			const defExpandBranches = <boolean>ConfigMaid.get("git-branches.view.defaultExpandBranches");
			//#endregion CONFIGS

			//#region COLORS
			const PINNED_COLOR = VSColors.interpolate("#FFDF00");
			const MERGED_COLOR = VSColors.interpolate("#0F0");
			const UNMERGED_COLOR = VSColors.interpolate("#F00");
			//#endregion COLORS

			const branches = await this.gitRunner.getBranches(includeRemoteBranches ? "all" : "local", {
				sort: branchesSortMethod,
			});
			const itemsState = branches.length === 1 ? "none" : defExpandBranches ? "expand" : "collapse";

			let localItems: BranchItem[] = [];
			let remoteItems: BranchItem[] = [];
			let detachedItems: BranchItem[] = [];
			await Aux.async.map(branches, async (branch, i) => {
				const item = new BranchItem(branch, itemsState);

				const iconId = {
					local: "git-branch",
					remote: "github-alt",
					detached: "git-pull-request-draft",
				}[branch.type];
				item.iconPath = new ThemeIcon(
					iconId,
					pinnedBranches.includes(branch.name) ? PINNED_COLOR : VSColors.hash(branch.id),
				);

				let noRevision;
				let latestHash;
				try {
					latestHash = await this.gitRunner.getLatestHash(branch, { short: true });
				} catch {
					noRevision = true;
				}

				const lastUpdated = await this.gitRunner.getUpdatedTime(branch, "local");
				item.tooltip = new MarkdownString(
					`$(${iconId}) ${Aux.string.capital(branch.type)} - _${branch.id}_  \n${
						noRevision ? "No Revision" : "Latest Commit __" + latestHash + "__"
					}  \nUpdated _${lastUpdated}_`,
				);

				({
					local: localItems,
					remote: remoteItems,
					detached: detachedItems,
				})[branch.type][i] = item;
			});

			[localItems, remoteItems, detachedItems] = [localItems, remoteItems, detachedItems].map((items) => {
				return items.flat().sort((a, b) => {
					return pinnedBranches.indexOf(b.branch.name) - pinnedBranches.indexOf(a.branch.name);
				});
			});

			const items: BranchItem[] = [].concat(localItems, remoteItems, detachedItems);
			await Aux.async.map(items, async (item, i) => {
				const parentBranch = item.branch;

				let mergedItems: BranchItem[] = [];
				let unmergedItems: BranchItem[] = [];
				await Aux.async.map(items, async (item, i) => {
					const childBranch = item.branch;
					if (childBranch === parentBranch) return;

					const child = new BranchItem(childBranch, "none");

					const branchDiff = await this.gitRunner.getBranchDiff(childBranch, parentBranch);
					const isMerged = branchDiff.from === 0;
					const mergeBase = await this.gitRunner.getMergeBaseHash(childBranch, parentBranch, { short: true });

					child.description = `${Aux.string.capital(childBranch.type)} - ${
						isMerged ? `Merged` : "↓" + branchDiff.from
					} ↑${branchDiff.to}`;
					console.log((<MarkdownString>item.tooltip).value);
					child.tooltip = new MarkdownString(
						`${(<MarkdownString>item.tooltip).value}\n\n${
							isMerged ? `Fully Merged` : "From $(arrow-down) _" + branchDiff.from + "_"
						} __-__ To $(arrow-up) _${branchDiff.to}_ ${
							isMerged ? "" : " __-__ Sym $(arrow-swap) _" + branchDiff.sym + "_"
						}  \nMerge Base __${mergeBase}__`,
						true,
					);
					child.collapsibleState = TreeItemCollapsibleState.None;

					if (isMerged) {
						child.iconPath = new ThemeIcon("check", MERGED_COLOR);
						mergedItems[i] = child;
						return;
					}
					child.iconPath = new ThemeIcon("x", UNMERGED_COLOR);
					unmergedItems[i] = child;
				});
				(mergedItems = mergedItems.flat()), (unmergedItems = unmergedItems.flat());

				item.children = [].concat(
					mergedItems,
					...(mergedItems.length > 0 && unmergedItems.length > 0 ? [SEPARATOR_ITEM] : []),
					unmergedItems,
					...(i !== items.length - 1 ? [SEPARATOR_ITEM] : []),
				);

				const fullyMerged = unmergedItems.length === 0;
				item.description =
					`${Aux.string.capital(parentBranch.type)} - ` +
					(fullyMerged ? "Fully Merged" : `\u2713${mergedItems.length} \u00d7${unmergedItems.length}`);
				item.tooltip = new MarkdownString(
					`${(<MarkdownString>item.tooltip).value}\n\n` +
						(fullyMerged
							? "Fully Merged"
							: `Merged $(check) _${mergedItems.length}_ __-__ Unmerged $(x) _${unmergedItems.length}_`),
					true,
				);
			});

			return [].concat(
				localItems,
				...(localItems.length > 0 && remoteItems.length > 0 ? [SEPARATOR_ITEM] : []),
				remoteItems,
				...(remoteItems.length > 0 && detachedItems.length > 0 ? [SEPARATOR_ITEM] : []),
				...(remoteItems.length === 0 && localItems.length > 0 && detachedItems.length > 0
					? [SEPARATOR_ITEM]
					: []),
				detachedItems,
			);
		}
	}

	const provider = new Provider();
	const explorer: TreeView<BranchItem | typeof SEPARATOR_ITEM> = window.createTreeView("git-branches.gitBranches", {
		treeDataProvider: provider,
		showCollapseAll: true,
		canSelectMany: false,
	});

	/**
	 * Inits Git Branches provider, view and event listeners
	 */
	export async function initView(): Promise<void> {
		// ConfigMaid.onChange(
		// 	["view.defaultExpandPrimaryGroups", "view.defaultExpandSecondaryGroups"],
		// 	updateExpandState,

		Janitor.add(explorer);

		await provider.initProvider();
		commands.executeCommand("setContext", "git-branches.init", true);

		// Janitor.add(
		// 	explorer,
		// 	explorer.onDidChangeVisibility((ev) => {
		// 		if (ev.visible) {
		// 			setTimeout(() => provider.refresh(), 1000);
		// 			return;
		// 		}
		// 		if (!updateQueued) return;
		// 		updateQueued = false;
		// 		updateView();
		// 	}),

		// 	EventEmitter.subscribe("update", updateView),

		// 	window.onDidChangeTextEditorSelection((ev) => onChangeEditorSelection(ev.textEditor)),

		// 	commands.registerCommand("git-branches.expandExplorer", () => {
		// 		for (const item of provider.items) explorer.reveal(item, { select: false, expand: 2 });
		// 	}),
		// 	commands.registerCommand("git-branches.switchToFileView", () => updateViewType("File")),
		// 	commands.registerCommand("git-branches.switchToTagView", () => updateViewType("Tag")),
		// 	commands.registerCommand("git-branches.completeAllMemos", completeAllMemos),

		// 	commands.registerCommand("git-branches.navigateToFile", (fileItem: FileItem) =>
		// 		fileItem.navigateTo(),
		// 	),
		// 	commands.registerCommand("git-branches.completeFile", (fileItem: FileItem) =>
		// 		fileItem.markMemosAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.completeFileNoConfirm", (fileItem: FileItem) =>
		// 		fileItem.markMemosAsCompleted({ noConfirm: true }),
		// 	),
		// 	commands.registerCommand("git-branches.completeTag", (tagItem: TagItem) =>
		// 		tagItem.markMemosAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.completeTagNoConfirm", (tagItem: TagItem) =>
		// 		tagItem.markMemosAsCompleted({ noConfirm: true }),
		// 	),
		// 	commands.registerCommand("git-branches.navigateToMemo", (memoItem: MemoItem) =>
		// 		memoItem.navigateTo(),
		// 	),
		// 	commands.registerCommand("git-branches.completeMemo", (memoItem: MemoItem) =>
		// 		memoItem.markAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.confirmCompleteMemo", (memoItem: MemoItem) =>
		// 		memoItem.markAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.completeMemoNoConfirm", (memoItem: MemoItem) =>
		// 		memoItem.markAsCompleted({ noConfirm: true }),
		// 	),
		// );

		// await provider.initProvider();
		//MO TODO add loading welcome view

		// const editor = window.activeTextEditor;
		// if (editor?.selection) onChangeEditorSelection(editor);
	}

	// /**
	//  * Reloads explorer with updated items from {@link MemoEngine},
	//  * delays update if explorer is hidden or if update is suppressed
	//  */
	// export async function updateView(): Promise<void> {
	// 	if (explorer.visible && !updateSuppressed) await provider.reloadItems();
	// 	else updateQueued = true;
	// }

	// /**
	//  * Updates provider items (does not reload items)
	//  * @param item item to be updated, if not given the whole tree is refreshed
	//  */
	// export function refresh(item?: Branch): void {
	// 	provider.refresh(item);
	// }

	// /**
	//  * Removes `items` from treeview
	//  */
	// export function removeItems(...items: Branch[]): void {
	// 	provider.removeItems(...items);
	// }

	// /**
	//  * Suppresses view update (does not affect view refresh)
	//  */
	// export function suppressUpdate(): void {
	// 	updateSuppressed = true;
	// }

	// /**
	//  * Unsuppresses view update
	//  */
	// export function unsuppressUpdate(): void {
	// 	updateSuppressed = false;
	// }

	// /**
	//  * Updates view's view type (primary-secondary items hierarchy)
	//  * @param viewType "File" - primary items is workspace documents; "Tag" - primary items is Memo tags
	//  */
	// function updateViewType(viewType: "File" | "Tag"): void {
	// 	provider.viewType = viewType;
	// 	commands.executeCommand("setContext", "git-branches.explorerView", viewType);
	// 	updateView();
	// }

	// /**
	//  * Updates primary & secondary item's expand/collapse state
	//  */
	// async function updateExpandState(expandPrimaryItems: boolean, expandSecondaryItems: boolean): Promise<void> {
	// 	const afterReveal = async () => {
	// 		await commands.executeCommand("list.collapseAll");
	// 		if (expandSecondaryItems) {
	// 			await Aux.async.map(
	// 				provider.items.flatMap((item) => item.children),
	// 				async (child) => await explorer.reveal(child, { select: false, expand: true }),
	// 			);
	// 		}
	// 		for (const item of provider.items) {
	// 			if (expandPrimaryItems) {
	// 				explorer.reveal(item, { select: false, expand: true });
	// 				continue;
	// 			}
	// 			await explorer.reveal(item, { select: false, focus: true });
	// 			await commands.executeCommand("list.collapse");
	// 		}
	// 		await explorer.reveal(provider.items[0], {
	// 			select: false,
	// 			focus: true,
	// 		});
	// 	};

	// 	try {
	// 		await explorer.reveal(provider.items[0], { select: false, focus: true });
	// 		await afterReveal();
	// 	} catch {}
	// }

	// /**
	//  * View action to mark all known Memos to be completed
	//  */
	// async function completeAllMemos(): Promise<void> {
	// 	suppressUpdate();
	// 	const memoCount = provider.memoCount;
	// 	const items = provider.items;

	// 	const completionDetail = `Are you sure you want to proceed?
	// 		This will mark all ${memoCount} memo${Aux.string.plural(memoCount)} ${provider.viewType === "File" ? "in" : "under"} ${
	// 		items.length
	// 	} ${provider.viewType.toLowerCase()}${Aux.string.plural(items)} as completed.`;
	// 	const option = await window.showInformationMessage(
	// 		"Confirm Completion of Memos",
	// 		{ modal: true, detail: completionDetail },
	// 		"Yes",
	// 	);
	// 	if (!option) {
	// 		unsuppressUpdate();
	// 		return;
	// 	}

	// 	for (const item of items) await item.markMemosAsCompleted({ noConfirm: true, _noExtraTasks: true });
	// 	MemoEngine.forgetAllMemos();
	// 	provider.removeAllItems();
	// 	refresh();
	// 	unsuppressUpdate();
	// }

	// /**
	//  * Selects the MemoItem right before editor selection in Memo Explorer
	//  */
	// function onChangeEditorSelection(editor: TextEditor): void {
	// 	if (!explorer.visible) return;

	// 	const doc = editor.document;
	// 	if (!MemoEngine.isDocWatched(doc)) return;

	// 	const memoItems = provider.getMemoItems();
	// 	const docMemoItems = memoItems.filter((memoItem) => memoItem.memo.fileName === doc.fileName);
	// 	if (docMemoItems.length === 0) return;

	// 	let offset = doc.offsetAt(editor.selection.active);
	// 	if (MemoEngine.getMemoTemplate(doc.languageId).tail) offset--;
	// 	let i = Aux.algorithm.predecessorSearch(
	// 		docMemoItems.sort((m1, m2) => m1.memo.offset - m2.memo.offset),
	// 		offset,
	// 		(memoItem) => memoItem.memo.offset,
	// 	);
	// 	if (i === -1) i = 0;
	// 	explorer.reveal(docMemoItems[i]);
	// }
}

//MO TODO use following commands
// latest_commit_of_<branch> = $(git rev-parse <branch>)
// branches_containing_commit = $(git branch --contains $latest_commit_of_<branch>)
// the results would be taken care of in js, not in bash with grep/sed etc.
