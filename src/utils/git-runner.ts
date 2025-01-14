import { spawn } from "child_process";

import { Aux } from "./auxiliary";

export class Branch {
	ref: string;
	name: string;

	//MO NOTE do note that detached HEADs are technically not a branch
	constructor(public id: string, public type: "local" | "remote" | "detached") {
		this.ref = `${type === "detached" ? "" : type === "local" ? "refs/heads/" : "refs/remotes/"}${id}`;
		this.name = id.split("/").at(-1);
	}
}

export class GitRunner {
	constructor(public gitPath: string, public repoPath: string) {}

	async run(command: string, ...args: string[]): Promise<string> {
		return await new Promise((res, rej) => {
			const process = spawn(this.gitPath, [command].concat(args), { cwd: this.repoPath });
			process.stdout.setEncoding("utf8");
			process.stderr.setEncoding("utf8");

			let output = "";
			let error = "";
			process.stdout.on("data", (data) => {
				output += data;
			});
			process.stderr.on("data", (err) => {
				error += err;
			});

			process.on("close", (code) => {
				if (error === "" && code === 0) {
					return res(output.trim());
				}
				rej(`Git Runner closed with error code ${code}: ${error.trim()}`);
			});

			process.on("error", (err) => {
				rej(err);
			});
		});
	}

	async getBranches(type: "local" | "remote" | "all", options?: { sort?: "date" | "alphabet" }): Promise<Branch[]> {
		if (type === "all") {
			const branches = await Aux.async.map(["local", "remote"], async (type: "local" | "remote") =>
				this.getBranches(type, options),
			);
			return branches.flat();
		}

		const res = await this.run("branch", `-${type[0]}`);
		const branches = [];
		for (let line of res.split("\n")) {
			line = line
				.replaceAll(/[\(\)\*]/g, "")
				.replace(/.*? -> /, "")
				.trim();
			if (line.startsWith("HEAD detached")) {
				line = line.replace(/HEAD detached (?:from|at) /, "");
				branches.push(new Branch(line, "detached"));
				continue;
			}
			branches.push(new Branch(line, type));
		}

		if (options?.sort) branches.sort((a, b) => a.id.localeCompare(b.id));
		if (options?.sort === "date") {
			const timestamps: { [branchName: string]: number } = {};
			await Aux.async.map(branches, async ({ id: name, ref }) => {
				timestamps[name] = parseInt(await this.run("log", "-1", "--format=%cd", "--date=unix", ref));
			});
			branches.sort((a, b) => timestamps[b.id] - timestamps[a.id]);
		}

		return branches;
	}

	async getLatestHash(branch: Branch, options?: { short?: boolean }): Promise<string> {
		const optArgs = options?.short ? ["--short"] : [];
		return await this.run("rev-parse", ...optArgs, branch.ref);
	}

	async getUpdatedTime(
		branch: Branch,
		format: "default" | "relative" | "local" | "iso" | "rfc" = "default",
	): Promise<string> {
		return await this.run("log", "-1", "--format=%cd", `--date=${format}`, branch.ref);
	}
}
