/* eslint-disable @typescript-eslint/no-namespace */
import { Commit } from "neogit";

export namespace Md {
	export function time(data: { time: number; zone: number }): string {
		return new Date((data.time + data.zone * 60) * 1e3).toLocaleString(undefined, {
			dateStyle: "short",
			timeStyle: "short",
		});
	}

	export function meta(data: Commit["author"]): string {
		return `${data.name} &lt;${data.mail}> ${time(data)}`;
	}

	export function commit(name: string, commit: Commit): string {
		return `$(history) **${name}**  \n${commit.hash}\n\n${
			commit.message
		}\n\n$(account) **Author**  \n${meta(
			commit.author,
		)}  \n$(account) **Committer**  \n${meta(commit.commit)}`;
	}
}
