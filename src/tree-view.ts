import {
	Extension,
	TreeDataProvider,
	EventEmitter,
	Event,
	commands,
	extensions,
	window,
	TreeView,
	workspace,
	Uri,
	WorkspaceFolder,
} from "vscode";
import { API as GitAPI, GitExtension, Repository } from "./declarations/git";

import { Aux } from "./utils/auxiliary";
import { ConfigMaid } from "./utils/config-maid";

import { GitEngine } from "./git-engine";
import { TreeItems } from "./tree-items";
import { Janitor } from "./utils/janitor";

//MO TODO git-base.gitEnabled && gitOpenRepositoryCount > 0
//MO TODO capabilities: unsafe repositories ?

//MO TODO think of what to display when only 1 branch exists

const VSCODE_GIT_API_VERSION = 1;
const TIMEOUT_GET_REPO = 10;

export namespace GitBranchesTreeView {
	class Provider implements TreeDataProvider<TreeItems.Branch> {
		gitAPI: GitAPI;
		gitEnabled: boolean;

		items: TreeItems.Branch[] = [];

		private treeDataChangeEmitter: EventEmitter<void | undefined | TreeItems.Branch> = new EventEmitter<
			void | undefined | TreeItems.Branch
		>();
		onDidChangeTreeData: Event<void | undefined | TreeItems.Branch> = this.treeDataChangeEmitter.event;

		async initProvider(): Promise<void> {
			this.gitAPI = await this.getGitAPI();

			this.gitEnabled = true;
			ConfigMaid.onChange("git.enabled", (enabled) => {
				this.gitEnabled = enabled;
			});

			const primaryRepo = await this.getPrimaryRepo();
			if (!primaryRepo) return;

			window.showInformationMessage(primaryRepo.rootUri.path);
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

		getTreeItem(element: TreeItems.Branch): TreeItems.Branch {
			return element;
		}

		getParent(element: TreeItems.Branch): undefined | TreeItems.Branch {
			return element.parent;
		}

		getChildren(element: TreeItems.Branch | undefined): TreeItems.Branch[] {
			if (element) return element.children;
			return this.items;
		}

		//#endregion End of interface implementation methods

		/**
		 * Removes `items` from provider
		 */
		removeItems(...items: TreeItems.Branch[]): void {
			this.items = Aux.array.removeFrom(this.items, ...items);
		}

		/**
		 * Removes all items from provider
		 */
		removeAllItems(): void {
			this.items = [];
		}

		/**
		 * Updates provider items (does not reload items)
		 * @param item item to be updated, if not given the whole tree is refreshed
		 */
		refresh(item?: TreeItems.Branch): void {
			this.treeDataChangeEmitter.fire(item);
		}

		/**
		 * Reloads provider with updated items
		 */
		async reloadItems(repo: Repository): Promise<void> {
			this.items = await this.getItems();
			this.treeDataChangeEmitter.fire();
		}

		/**
		 * Retrieves updates and builds view items
		 * @returns built items (primary-hierarchy)
		 */
		private async getItems(): Promise<TreeItems.Branch[]> {
			// const expandPrimaryGroup = ConfigMaid.get("view.defaultExpandBranches");
			// expandPrimaryGroup;
			return [];

			// const tagColors = await MemoEngine.getTagColors();
			// const inner = Aux.object.group(memos, isFileView ? "fileName" : "tag");
			// const innerLabels = Object.keys(inner).sort();
			// const innerItems = innerLabels.map(
			// 	(label) => new (isFileView ? TreeItems.FileItem : TreeItems.TagItem)(label, expandPrimaryGroup),
			// );

			// await Aux.async.range(innerLabels.length, async (i) => {
			// 	const innerLabel = innerLabels[i];
			// 	const innerItem = innerItems[i];
			// 	if (!isFileView) innerItem.iconPath = new ThemeIcon("bookmark", tagColors[innerLabel]);

			// 	const halfLeaves = Aux.object.group(inner[innerLabel], isFileView ? "tag" : "fileName");
			// 	const halfLeafLabels = Object.keys(halfLeaves).sort();
			// 	const halfLeafItems: TreeItems.Branch[] = isFileView
			// 		? halfLeafLabels.map(
			// 				(label) =>
			// 					new TreeItems.TagItem(label, expandSecondaryGroup, <TreeItems.FileItem>innerItem),
			// 		  )
			// 		: halfLeafLabels.map(
			// 				(label) =>
			// 					new TreeItems.FileItem(label, expandSecondaryGroup, <TreeItems.TagItem>innerItem),
			// 		  );
			// 	innerItem.children = halfLeafItems;

			// 	let childMemoCount = 0;
			// 	await Aux.async.range(innerItem.children.length, async (j) => {
			// 		const halfLeafItem = <TreeItems.Branch>innerItem.children[j];
			// 		const halfLeafLabel = halfLeafLabels[j];
			// 		if (isFileView) halfLeafItem.iconPath = new ThemeIcon("bookmark", tagColors[halfLeafLabel]);

			// 		let memos = <MemoEngine.Memo[]>halfLeaves[halfLeafLabel];
			// 		const [important, normal]: MemoEngine.Memo[][] = [[], []];
			// 		for (const memo of memos) {
			// 			if (memo.priority !== 0) {
			// 				important.push(memo);
			// 				continue;
			// 			}
			// 			normal.push(memo);
			// 		}
			// 		memos = important.sort((a, b) => b.priority - a.priority).concat(normal);
			// 		childMemoCount += memos.length;

			// 		halfLeafItem.description = `${memos.length} Memo${Aux.string.plural(memos)}`;
			// 		halfLeafItem.tooltip = new MarkdownString(
			// 			`${isFileView ? "Tag: " : "File: *"}${halfLeafItem.label}${isFileView ? "" : "*"} - ${
			// 				memos.length
			// 			} $(pencil)`,
			// 			true,
			// 		);

			// 		const tagColor = (<ThemeIcon>(isFileView ? halfLeafItem : innerItem).iconPath).color;
			// 		const maxPriority = Math.max(...memos.map((memo) => memo.priority));
			// 		const memoItems = await Aux.async.map(
			// 			memos,
			// 			async (memo) => new TreeItems.MemoItem(memo, tagColor, halfLeafItem, maxPriority),
			// 		);
			// 		halfLeafItem.children = memoItems;
			// 	});

			// 	innerItem.description = `${halfLeafItems.length} ${isFileView ? "Tag" : "File"}${Aux.string.plural(
			// 		halfLeafItems,
			// 	)} > ${childMemoCount} Memo${Aux.string.plural(childMemoCount)}`;
			// 	innerItem.tooltip = new MarkdownString(
			// 		`${isFileView ? "File: *" : "Tag: "}${innerItem.label}${isFileView ? "*" : ""} - ${
			// 			halfLeafItems.length
			// 		} ${isFileView ? "$(bookmark)" : "$(file)"} ${childMemoCount} $(pencil)`,
			// 		true,
			// 	);
			// });

			// return innerItems;
		}
	}
	const provider = new Provider();
	const explorer: TreeView<TreeItems.Branch> = window.createTreeView("git-branches.gitBranches", {
		treeDataProvider: provider,
		showCollapseAll: true,
		canSelectMany: false,
	});

	/**
	 * Inits Memo Explorer provider, view and event listeners
	 */
	export async function initView(): Promise<void> {
		// ConfigMaid.onChange("view.defaultView", updateViewType);
		// ConfigMaid.onChange(
		// 	["view.defaultExpandPrimaryGroups", "view.defaultExpandSecondaryGroups"],
		// 	updateExpandState,
		// );

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

		// 	commands.registerCommand("git-branches.navigateToFile", (fileItem: TreeItems.FileItem) =>
		// 		fileItem.navigateTo(),
		// 	),
		// 	commands.registerCommand("git-branches.completeFile", (fileItem: TreeItems.FileItem) =>
		// 		fileItem.markMemosAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.completeFileNoConfirm", (fileItem: TreeItems.FileItem) =>
		// 		fileItem.markMemosAsCompleted({ noConfirm: true }),
		// 	),
		// 	commands.registerCommand("git-branches.completeTag", (tagItem: TreeItems.TagItem) =>
		// 		tagItem.markMemosAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.completeTagNoConfirm", (tagItem: TreeItems.TagItem) =>
		// 		tagItem.markMemosAsCompleted({ noConfirm: true }),
		// 	),
		// 	commands.registerCommand("git-branches.navigateToMemo", (memoItem: TreeItems.MemoItem) =>
		// 		memoItem.navigateTo(),
		// 	),
		// 	commands.registerCommand("git-branches.completeMemo", (memoItem: TreeItems.MemoItem) =>
		// 		memoItem.markAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.confirmCompleteMemo", (memoItem: TreeItems.MemoItem) =>
		// 		memoItem.markAsCompleted(),
		// 	),
		// 	commands.registerCommand("git-branches.completeMemoNoConfirm", (memoItem: TreeItems.MemoItem) =>
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
	// export function refresh(item?: TreeItems.Branch): void {
	// 	provider.refresh(item);
	// }

	// /**
	//  * Removes `items` from treeview
	//  */
	// export function removeItems(...items: TreeItems.Branch[]): void {
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
