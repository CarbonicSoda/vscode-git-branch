import { ReadCommitResult } from "isomorphic-git";

export namespace Md {
	export function time(data: {
		timestamp: number;
		timezoneOffset: number;
	}): string {
		return new Date(
			(data.timestamp + data.timezoneOffset * 60) * 1e3,
		).toLocaleString(undefined, {
			dateStyle: "short",
			timeStyle: "short",
		});
	}

	export function contributor(
		data: ReadCommitResult["commit"]["author" | "committer"],
	): string {
		return `${data.name} &lt;${data.email}> ${time(data)}`;
	}

	export function commit(name: string, commit: ReadCommitResult): string {
		return `$(history) **${name}**  \n${commit.oid}\n\n${
			commit.commit.message
		}\n\n$(account) **Author**  \n${contributor(
			commit.commit.author,
		)}  \n$(account) **Committer**  \n${contributor(commit.commit.committer)}`;
	}
}
