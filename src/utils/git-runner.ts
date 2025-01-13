import { spawn } from "child_process";

import { Aux } from "./auxiliary";

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

	async getBranches(type: "local" | "remote", options?: { sort?: "date" | "alphabet" }): Promise<string[]> {
		const res = await this.run("branch", `-${type[0]}`);
		let branches = res.split("\n").map((line) =>
			line
				.replaceAll(/[\(\)\*]/g, "")
				.replace(/HEAD detached (?:from|at) /, "DETACHED - ")
				.trim(),
		);

		if (options?.sort) branches.sort();
		if (options?.sort === "date") {
			const timestamps: { [branch: string]: number } = {};
			await Aux.async.map(branches, async (branch) => {
				const isDetached = branch.startsWith("DETACHED - ");
				if (isDetached) branch = branch.replace(/DETACHED - /, "");

				timestamps[branch] = parseInt(
					await this.run(
						"log",
						"-1",
						"--format=%cd",
						"--date=unix",
						`${type === "remote" || isDetached ? "" : "refs/heads/"}${branch}`,
					),
				);
			});
			branches.sort((a, b) => timestamps[b] - timestamps[a]);
		}

		return branches;
	}

	async getLatestHash(branch: string, options?: { short?: boolean }): Promise<string> {
		const optArgs = options?.short ? ["--short"] : [];
		return await this.run("rev-parse", ...optArgs, branch);
	}

	async getUpdatedTime(
		branch: string,
		isRemote: boolean,
		isDetached: boolean,
		format: "default" | "relative" | "local" | "iso" | "rfc" = "default",
	): Promise<string> {
		return await this.run(
			"log",
			"-1",
			"--format=%cd",
			`--date=${format}`,
			`${isRemote || isDetached ? "" : "refs/heads/"}${branch}`,
		);
	}
}
