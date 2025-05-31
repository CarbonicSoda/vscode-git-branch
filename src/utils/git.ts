import { execFile } from "node:child_process";
import { extensions } from "vscode";

import { GitExtension, Repository } from "../declarations/git";

type BranchType = "local" | "remote";

export class Branch {
	type: BranchType;
	name: string;

	constructor(
		public head: boolean,
		public ref: `refs/${"heads" | "remotes"}/${string}`,
	) {
		this.type = this.ref.startsWith("refs/heads") ? "local" : "remote";
		this.name = ref.split("/").at(-1)!;
	}
}

export class GitRunner {
	get gitPath(): string {
		const gitExtension =
			extensions.getExtension<GitExtension>("vscode.git")!.exports;
		const gitExtensionApi = gitExtension.getAPI(1);

		return gitExtensionApi.git.path;
	}

	constructor(public repo: Repository) {}

	async run(command: string, ...args: string[]): Promise<string> {
		return await new Promise((res, rej) => {
			execFile(
				this.gitPath,
				[command].concat(args),
				{ cwd: this.repo.rootUri.fsPath },
				(err, stdout) => (err ? rej(err) : res(stdout.trimEnd())),
			);
		});
	}

	async getBranches(type: "all" | BranchType): Promise<Branch[]> {
		const branches = [];

		const res = await this.run(
			"branch",
			`-${type[0]}`,
			"--format=%(refname)%(HEAD)",
			"--omit-empty",
		);

		for (let ref of res.split("\n").map((line) => line.trimEnd())) {
			if (ref.endsWith("/HEAD")) continue;

			const head = ref.endsWith("*");
			if (head) ref = ref.slice(0, -1);

			const branch = new Branch(
				head,
				ref as `refs/${"heads" | "remotes"}/${string}`,
			);
			branches.push(branch);
		}

		return branches.sort((a, b) => a.ref.localeCompare(b.ref));
	}
}
