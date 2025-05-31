import { extensions, window } from "vscode";

import { GitExtension } from "./declarations/git";

import { TreeProvider } from "./tree-provider";
import { Janitor } from "./utils/janitor";

export namespace TreeView {
	const expand = { primary: true, secondary: true };

	export async function init(): Promise<void> {
		const gitExtension =
			extensions.getExtension<GitExtension>("vscode.git")!.exports;
		const gitExtensionApi = gitExtension.getAPI(1);

		if (gitExtensionApi.repositories.length === 0) {
			await new Promise<void>((res) => {
				const disposable = gitExtensionApi.onDidOpenRepository(() => {
					res();
					disposable.dispose();
				});
			});
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

		//MO TODO check if this can be moved
		// explorer.title = provider.repo.rootUri.path.split("/").at(-1);

		updateView();
	}
}
