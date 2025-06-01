import { extensions, window } from "vscode";

import { GitExtension } from "./declarations/git";

import { TreeProvider } from "./tree-provider";
import { Aux } from "./utils/auxiliary";
import { Janitor } from "./utils/janitor";

export namespace TreeView {
	const expand = { primary: true, secondary: true };

	export async function init(): Promise<void> {
		const gitAPI = extensions
			.getExtension<GitExtension>("vscode.git")!
			.exports.getAPI(1);

		if (gitAPI.state === "uninitialized") {
			await Aux.event.wait(gitAPI.onDidChangeState);
		}

		const provider = new TreeProvider();

		const explorer = window.createTreeView("git-branch-master.gitBranches", {
			treeDataProvider: provider,
			canSelectMany: false,
		});

		Janitor.add(explorer);

		function updateView(): void {
			provider.refresh(undefined, expand);
		}

		updateView();
	}
}
