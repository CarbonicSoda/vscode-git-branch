import { window } from "vscode";

import { Janitor } from "../utils/janitor";

import { TreeProvider } from "./tree-provider";

export namespace TreeView {
	const expand = { primary: true, secondary: true };

	export async function init(): Promise<void> {
		const provider = new TreeProvider();

		const explorer = window.createTreeView("git-branch-master.gitBranches", {
			treeDataProvider: provider,
			canSelectMany: false,
		});

		Janitor.add(explorer);

		const updateView = () => provider.refresh(undefined, expand);

		updateView();
	}
}
