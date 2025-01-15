import { commands, TreeView, window } from "vscode";

import { BranchesTreeProvider } from "./tree-provider";
import { Janitor } from "./utils/janitor";

/**
 * Provides Git Branches view on primary sidebar, main presentation module
 */
export namespace BranchesTreeView {
	const provider = new BranchesTreeProvider.Provider();
	const explorer: TreeView<BranchesTreeProvider.BranchItem | BranchesTreeProvider.SEPARATOR_ITEM> =
		window.createTreeView("git-branches.gitBranches", {
			treeDataProvider: provider,
			showCollapseAll: true,
			canSelectMany: false,
		});

	/**
	 * Inits Git Branches provider, view and event listeners
	 */
	export async function initView(): Promise<void> {
		Janitor.add(explorer);

		await provider.initProvider();
		commands.executeCommand("setContext", "git-branches.init", true);
	}
}
