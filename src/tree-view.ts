import { commands, TreeItem, TreeView, window } from "vscode";

import { BranchesTreeProvider } from "./tree-provider";
import { Janitor } from "./utils/janitor";
import { ConfigMaid } from "./utils/config-maid";

/**
 * Provides Git Branches view on primary sidebar, main presentation module
 */
export namespace BranchesTreeView {
	const provider = new BranchesTreeProvider.Provider();
	const explorer: TreeView<BranchesTreeProvider.BranchItem | TreeItem> = window.createTreeView(
		"git-branches.gitBranches",
		{
			treeDataProvider: provider,
			showCollapseAll: true,
			canSelectMany: false,
		},
	);

	/**
	 * Inits Git Branches provider, view and event listeners
	 */
	export async function initView(): Promise<void> {
		ConfigMaid.onChange("git-branches.view", () => provider.reloadItems());

		Janitor.add(explorer);

		await provider.initProvider();
		commands.executeCommand("setContext", "git-branches.init", true);
	}
}
