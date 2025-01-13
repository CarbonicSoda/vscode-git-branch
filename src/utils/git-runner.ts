import { spawn } from "child_process";

export class GitRunner {
	constructor(public gitPath: string, public repoPath: string) {}

	async run(command: string, ...args: string[]): Promise<string> {
		const buffer = await new Promise<Buffer>((res, rej) => {
			const process = spawn(this.gitPath, [command].concat(args), { cwd: this.repoPath });

			process.stdout.on("data", (data) => {
				res(data);
				process.kill();
			});
			process.stderr.on("data", (err) => {
				rej(err);
				process.kill();
			});
			process.on("error", (err) => {
				rej(err);
				process.kill();
			});
		});
		return buffer.toString("utf8");
	}
}
