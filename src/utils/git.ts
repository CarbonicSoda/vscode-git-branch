import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extensions, MarkdownString } from "vscode";

import { GitExtension, Repository } from "../declarations/git";

const exec = promisify(execFile);

export class Branch {
	type: "local" | "remote";
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
		const gitAPI = extensions
			.getExtension<GitExtension>("vscode.git")!
			.exports.getAPI(1);

		return gitAPI.git.path;
	}

	constructor(public repo: Repository) {}

	async run(...args: string[]): Promise<string> {
		const res = await exec(this.gitPath, args, {
			cwd: this.repo.rootUri.fsPath,
		});
		return res.stdout.trimEnd();
	}

	async getBranches(): Promise<Branch[]> {
		const branches = [];

		const res = await this.run(
			"branch",
			`-a`,
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

	async getLastCommit(branch: Branch): Promise<string> {
		try {
			return await this.run("rev-parse", branch.ref);
		} catch {
			return "None";
		}
	}

	async getLastUpdated(branch: Branch): Promise<string> {
		return await this.run(
			"log",
			"-1",
			"--format=%cd",
			"--date=format-local:%B %d, %Y at %I:%M %p",
			branch.ref,
		);
	}

	async getBranchDiff(
		branch1: Branch,
		branch2: Branch,
	): Promise<{
		fm: string[];
		to: string[];
	}> {
		const resFm = await this.run("rev-list", `${branch1.ref}..${branch2.ref}`);
		const resTo = await this.run("rev-list", `${branch2.ref}..${branch1.ref}`);

		const fm =
			resFm === "" ? [] : resFm.split("\n").map((hash) => hash.trimEnd());
		const to =
			resTo === "" ? [] : resTo.split("\n").map((hash) => hash.trimEnd());

		return { fm, to };
	}

	async getMergeBase(branch1: Branch, branch2: Branch): Promise<string> {
		try {
			return await this.run("merge-base", branch1.ref, branch2.ref);
		} catch {
			return "None";
		}
	}

	async getCommitMd(hash: string, tag: string): Promise<MarkdownString> {
		const md = await this.run(
			"log",
			"-1",
			`--format=$(history) ${tag} %h  %n%ad%n%n---%n%B`,
			"--date=format-local:%B %d, %Y at %I:%M %p",
			hash,
		);

		return new MarkdownString(md, true);
	}
}
