import { spawn } from "child_process";

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
					return res(output);
				}
				rej(`Git Runner closed with error code ${code}: ${error}`);
			});

			process.on("error", (err) => {
				rej(err);
			});
		});
	}
}
