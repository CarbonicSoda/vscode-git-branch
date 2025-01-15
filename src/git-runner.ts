import { execFile } from "node:child_process";

import { Aux } from "./utils/auxiliary";

export class Branch {
	ref: string;
	name: string;

	constructor(public id: string, public type: "local" | "remote") {
		this.ref = `${type === "local" ? "refs/heads/" : "refs/remotes/"}${id}`;
		this.name = id.split("/").at(-1);
	}
}

export class GitRunner {
	constructor(public gitPath: string, public repoPath: string) {}

	async run(command: string, ...args: string[]): Promise<string> {
		return await new Promise((res, rej) => {
			execFile(this.gitPath, [command].concat(args), { cwd: this.repoPath }, (err, stdout, stderr) => {
				if (err) return rej(err);
				if (stderr) return rej(stderr);
				res(stdout.trim());
			});
		});
	}

	async getBranches(
		type: "local" | "remote" | "all",
		options?: { flags?: string[]; sort?: "Commit Date" | "Alphabetic" },
	): Promise<Branch[]> {
		if (type === "all") {
			const branches = await Aux.async.map(
				["local", "remote"],
				async (type: "local" | "remote") => await this.getBranches(type, options),
			);
			return branches.flat();
		}

		const res = await this.run("branch", `-${type[0]}`, ...(options?.flags ?? []));
		let branches = [];
		for (const line of res.split("\n")) {
			if (line.length === 0 || line.includes("HEAD ")) continue;
			const ref = line.replace("*", "").trim();
			branches.push(new Branch(ref, type));
		}

		if (options?.sort) branches.sort((a, b) => a.id.localeCompare(b.id));
		if (options?.sort === "Commit Date") {
			const timestamps: { [branchName: string]: number } = {};
			await Aux.async.map(branches, async ({ id, ref }) => {
				timestamps[id] = parseInt(await this.run("log", "-1", "--format=%cd", "--date=unix", ref));
			});
			branches.sort((a, b) => timestamps[b.id] - timestamps[a.id]);
		}

		return branches;
	}

	async getLatestHash(branch: Branch, options?: { short?: boolean }): Promise<string> {
		return await this.run("rev-parse", ...Aux.array.opt(options?.short, "--short"), branch.ref);
	}

	async getUpdatedTime(
		branch: Branch,
		format: "default" | "relative" | "local" | "iso" | "rfc" = "default",
	): Promise<string> {
		return await this.run("log", "-1", "--format=%cd", `--date=${format}`, branch.ref);
	}

	async getBranchDiff(
		branch1: Branch,
		branch2: Branch,
	): Promise<{
		from: number;
		to: number;
		sym: number;
	}> {
		const resFrom = this.run("rev-list", "--count", `${branch1.ref}..${branch2.ref}`);
		const resTo = this.run("rev-list", "--count", `${branch2.ref}..${branch1.ref}`);
		const [from, to] = (await Promise.all([resTo, resFrom])).map((res) => parseInt(res.trim()));
		return {
			from,
			to,
			sym: from + to,
		};
	}

	async getMergeBaseHash(branch1: Branch, branch2: Branch, options?: { short?: boolean }): Promise<string> {
		let hash = await this.run("merge-base", branch1.ref, branch2.ref);
		if (options?.short) hash = hash.slice(0, 7);
		return hash;
	}
}
