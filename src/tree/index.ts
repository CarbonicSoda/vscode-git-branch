import { commands, TreeItemCollapsibleState, window } from "vscode";

import { Janitor } from "../utils/janitor";

import { TreeProvider } from "./tree-provider";

export namespace TreeView {
	const expand = { primary: true, secondary: false };

	export async function init(): Promise<void> {
		const provider = new TreeProvider();

		const explorer = window.createTreeView("git-branch-master.gitBranches", {
			treeDataProvider: provider,
			canSelectMany: false,
		});

		Janitor.add(
			explorer,

			//MO TODO remember to add context enablement to toggleFold
			commands.registerCommand("git-branch-master.toggleFold", () => {
				[expand.primary, expand.secondary] = [
					!expand.secondary,
					expand.primary && !expand.secondary,
				];

				for (const item of provider.items) {
					item.collapsibleState = expand.primary
						? TreeItemCollapsibleState.Expanded
						: TreeItemCollapsibleState.Collapsed;

					if (item.label.endsWith("\u200b")) {
						item.label = item.label.slice(0, -1);
					} else {
						item.label = item.label + "\u200b";
					}

					for (const child of item.children) {
						child.collapsibleState = expand.secondary
							? TreeItemCollapsibleState.Expanded
							: TreeItemCollapsibleState.Collapsed;
					}
				}
				provider.flush();
			}),

			commands.registerCommand(
				"git-branch-master.copyFullHash",
				(copy: () => Promise<void>) => copy(),
			),
		);

		const updateView = () => provider.refresh(undefined, expand);

		updateView();
	}
}
