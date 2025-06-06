import { ReadCommitResult } from "isomorphic-git";

export namespace Format {
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
}
