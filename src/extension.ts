import { Janitor } from "./utils/janitor";

import { GitBranchesTreeView } from "./tree-view";

export function activate(): void {
	GitBranchesTreeView.initView();

	//MO DEV not cleaned up yet
	// context.subscriptions.push(
	// 	vscode.commands.registerCommand("view-git-branch-merged.refresh", async () => {
	// 	}),
	// 	vscode.commands.registerCommand("view-git-branch-merged.copyBranchName", async (e, r) => {
	// 		vscode.env.clipboard.writeText(e.branch);
	// 	}),
	// 	vscode.commands.registerCommand("view-git-branch-merged.checkoutToBranch", async (e) => {
	// 		var t = vscode.window.createTerminal("view-git-branch-merged");
	// 		t.sendText(`git checkout ${e.branch}`, true);
	// 		t.show(true);
	// 	}),
	// 	vscode.commands.registerCommand("view-git-branch-merged.deleteBranch", async (e) => {
	// 		var t = vscode.window.createTerminal("view-git-branch-merged delete");
	// 		t.sendText(`git branch -D ${e.branch}`, false);
	// 		t.show(true);
	// 	}),
	// );
}

export function deactivate() {
	Janitor.cleanUp();
}
