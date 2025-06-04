import { Janitor } from "./utils/janitor";

import { listFiles } from "isomorphic-git";
import { workspace } from "vscode";
import { fs } from "./utils/fs";

export async function activate(): Promise<void> {
	console.log(workspace.workspaceFolders![0].uri);
	try {
		const files = await listFiles({
			fs,
			// dir: workspace.workspaceFolders![0].uri.fsPath,
			// ref: "HEAD",
		});
		console.log(files);
	} catch (error) {
		console.log(error);
	}
}

export function deactivate() {
	Janitor.cleanUp();
}
