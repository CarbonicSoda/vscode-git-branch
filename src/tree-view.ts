import {
	Extension,
	TreeDataProvider,
	EventEmitter,
	Event,
	extensions,
	window,
	TreeView,
	TreeItem,
	TreeItemCollapsibleState,
	ThemeIcon,
} from "vscode";
import { API as GitAPI, GitExtension, RefType, Repository } from "./declarations/git";

import { Janitor } from "./utils/janitor";
import { ConfigMaid } from "./utils/config-maid";
import { VSColors } from "./utils/vs-colors";
import { GitRunner } from "./utils/git-runner";

/**
 * Provides Git Branches view on primary sidebar, main presentation module
 */
export namespace GitBranchesTreeView {
	//#region CONSTANTS

	const VSCODE_GIT_API_VERSION = 1;

	const TIMEOUT_GET_REPO = 10;

	const PINNED_COLOR = VSColors.interpolate("#FFD700");

	//#endregion CONSTANTS

	/**
	 * Tree item class for a git branch
	 */
	class BranchItem extends TreeItem {
		public children: BranchItem[] = [];

		constructor(public name: string, expand: boolean | "none", public parent?: BranchItem) {
			let state: TreeItemCollapsibleState;
			if (expand === "none") state = TreeItemCollapsibleState.None;
			else state = expand ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;

			super(name, state);
		}
	}

	/**
	 * Git Branches tree data provider
	 */
	class Provider implements TreeDataProvider<BranchItem> {
		currRepo: Repository | null;
		currRepoFsPath?: string;

		items: BranchItem[] = [];

		private gitAPI: GitAPI;
		private gitPath: string;
		private gitEnabled: boolean;
		private gitRunner?: GitRunner;

		private treeDataChangeEmitter: EventEmitter<void | undefined | BranchItem> = new EventEmitter<
			void | undefined | BranchItem
		>();
		onDidChangeTreeData: Event<void | undefined | BranchItem> = this.treeDataChangeEmitter.event;

		/**
		 * Init provider and loads tree items
		 */
		async initProvider(): Promise<void> {
			this.gitAPI = await this.getGitAPI();
			this.gitPath = this.gitAPI.git.path;

			this.gitEnabled = true;
			ConfigMaid.onChange("git.enabled", (enabled) => {
				this.gitEnabled = enabled;
			});

			this.currRepo = await this.getPrimaryRepo();
			this.reloadItems();

			if (this.currRepo) {
				this.currRepoFsPath = this.currRepo.rootUri.fsPath;
				this.gitRunner = new GitRunner(this.gitPath, this.currRepoFsPath);
			}

			//MO TODO both shall be updated on currRepo update
		}

		/**
		 * Never resolves if Git/vscode.git is not enabled
		 * @returns GitAPI of vscode.git
		 */
		async getGitAPI(): Promise<GitAPI> {
			const gitExtension = await new Promise<Extension<GitExtension>>((res) => {
				const extension = extensions.getExtension<GitExtension>("vscode.git");
				if (extension) return res(extension);

				const retriever = extensions.onDidChange(() => {
					const extension = extensions.getExtension<GitExtension>("vscode.git");
					if (extension) {
						retriever.dispose();
						res(extension);
					}
				});
			});
			return gitExtension.exports.getAPI(VSCODE_GIT_API_VERSION);
		}

		/**
		 * Resolves after {@link TIMEOUT_GET_REPO} seconds if primary repo cant be found
		 * @returns Primary repository of workspace or null if not found
		 */
		async getPrimaryRepo(): Promise<Repository | null> {
			return await new Promise((res) => {
				const repo = this.gitAPI.repositories[0];
				if (repo) return res(repo);

				const once = this.gitAPI.onDidOpenRepository((repo) => {
					clearTimeout(timeout);
					once.dispose();
					res(repo);
				});
				const timeout = setTimeout(() => {
					once.dispose();
					res(null);
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

		getChildren(element: BranchItem | undefined): BranchItem[] {
			if (element) return element.children;
			return this.items;
		}

		//#endregion End of interface implementation methods

		/**
		 * Updates provider items (does not reload items)
		 * @param item item to be updated, if not given the whole tree is refreshed
		 */
		refresh(item?: BranchItem): void {
			if (!this.gitEnabled) return;
			this.treeDataChangeEmitter.fire(item);
		}

		/**
		 * Reloads provider with updated items
		 */
		async reloadItems(): Promise<void> {
			if (!this.gitEnabled) return;
			this.items = await this.getItems();
			this.treeDataChangeEmitter.fire();
		}

		/**
		 * Retrieves updates and builds view items
		 * @returns built items (primary-hierarchy)
		 */
		private async getItems(): Promise<BranchItem[]> {
			if (!this.gitEnabled) return [];

			const includeRemoteBranches = <boolean>ConfigMaid.get("git-branches.view.includeRemoteBranches");
			const branchesSortMethod = <"Commit Date" | "Alphabetic">(
				ConfigMaid.get("git-branches.view.branchesSortMethod")
			);
			const pinnedBranches = <string[]>ConfigMaid.get("git-branches.view.pinnedBranches");
			const defaultExpandBranches = <boolean>ConfigMaid.get("git-branches.view.defaultExpandBranches");

			const branches = await this.currRepo.getBranches({
				remote: includeRemoteBranches,
				sort: branchesSortMethod === "Commit Date" ? "committerdate" : "alphabetically",
			});

			const expandBranches = branches.length === 1 ? "none" : defaultExpandBranches;

			const heads = [];
			for (const branch of branches) {
				const name = branch.name;
				const isRemote = branch.type === RefType.RemoteHead;

				const item = new BranchItem(name, expandBranches);
				item.description = isRemote ? "Remote" : "Local";
				item.iconPath = new ThemeIcon(
					isRemote ? "github-alt" : "git-branch",
					pinnedBranches.includes(name) ? PINNED_COLOR : VSColors.hash(name),
				);
				heads.push(item);
			}

			const pinnedBranchesRev = pinnedBranches.reverse();
			return heads.sort(
				({ name: nameA }, { name: nameB }) =>
					pinnedBranchesRev.indexOf(nameB) - pinnedBranchesRev.indexOf(nameA),
			);
		}
	}
	const provider = new Provider();
	const explorer: TreeView<BranchItem> = window.createTreeView("git-branches.gitBranches", {
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
		// commands.executeCommand("setContext", "git-branches.explorerInitFinished", true);

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
