import { workspace } from "vscode";

import { Janitor } from "./janitor";

/**
 * Simplified functions for config related tasks
 */
export namespace Config {
	let userConfigs = workspace.getConfiguration("git-branch-master");

	/**
	 * `configName` should omit "git-branch-master." field prefix
	 */
	export function get(configName: string): any {
		return userConfigs.get(configName);
	}

	/**
	 * @param callback supplied with the new config values in order of appearance in `configs`
	 * @returns `id` for {@link Janitor.clear()}
	 */
	export function onChange(
		configs: string | string[],
		callback: (...newValues: any[]) => any,
	): number {
		const _configs = Array.isArray(configs) ? configs : [configs];

		const onChangeConfig = workspace.onDidChangeConfiguration((ev) => {
			if (
				!ev.affectsConfiguration("git-branch-master") ||
				!_configs.some((config) =>
					ev.affectsConfiguration(`git-branch-master.${config}`),
				)
			) {
				return;
			}

			userConfigs = workspace.getConfiguration("git-branch-master");
			callback(..._configs.map(get));
		});

		return Janitor.add(onChangeConfig);
	}

	/**
	 * Basically `setInterval()`,
	 * but the delay is a config value and will auto update.
	 * Also, the new timeout would only start after completion of callback
	 * @returns `id` for {@link Janitor.clear()}
	 */
	export function schedule(
		callback: () => any,
		delayConfigName: string,
	): number {
		const id = Janitor.currentId++;

		const startSchedule = async () => {
			await callback();
			next();
		};
		const next = () => {
			Janitor.override(id, setTimeout(startSchedule, get(delayConfigName)));
		};

		next();
		onChange(delayConfigName, next);

		return id;
	}

	Janitor.add(
		workspace.onDidChangeConfiguration((ev) => {
			if (!ev.affectsConfiguration("git-branch-master")) return;

			userConfigs = workspace.getConfiguration("git-branch-master");
		}),
	);
}
