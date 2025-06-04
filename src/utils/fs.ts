import { mkdir, promises as np } from "node:fs";

import { Buffer } from "buffer";
import { FileType, Uri, workspace } from "vscode";

import { type PromiseFsClient } from "isomorphic-git";
import { Aux } from "./auxiliary";

const wfs = workspace.fs;

const uri = (path: string) => Uri.parse(path, true);

// const promises: PromiseFsClient["promises"] = {
const promises = {
	readFile: async (path: string, utf8?: any) => {
		const buffer = Buffer.from(await wfs.readFile(uri(path)));

		return utf8 ? buffer.toString() : buffer;
	},

	writeFile: async (path: string, data: string | Buffer) => {
		if (typeof data === "string") data = Buffer.from(data);

		await wfs.writeFile(uri(path), data);
	},

	unlink: async (path: string) => {
		await wfs.delete(uri(path));
	},

	readdir: async (path: string) => {
		const entries = await wfs.readDirectory(uri(path));

		return entries.map(([name]) => name);
	},

	mkdir: async (path: string) => {
		await wfs.createDirectory(uri(path));
	},

	rmdir: async (path: string) => {
		if (path === "/") throw new Error("ENOTEMPTY");

		await wfs.delete(uri(path), { recursive: true });
	},

	stat: async (path: string) => {
		const stats = await wfs.stat(uri(path));

		const type = stats.type === FileType.File ? "file" : "dir";

		const ino = Aux.algorithm.fnv1a(`${path}:${stats.ctime}`);

		return {
			type,
			mode: 0o777,
			size: stats.size,
			ino,
			mtimeMs: stats.mtime,
			ctimeMs: stats.ctime,
			uid: 1,
			gid: 1,
			dev: 1,

			isFile: () => stats.type === FileType.File,
			isDirectory: () => stats.type === FileType.Directory,
			isSymbolicLink: () => stats.type === FileType.SymbolicLink,
		};
	},

	lstat: async (path: string) => {
		// const stats = await wfs.stat(uri(path));
		// const type = stats.type === FileType.File ? "file" : "dir";
		// const ino = Aux.algorithm.fnv1a(`${path}:${stats.ctime}`);
		// return {
		// 	type,
		// 	mode: 0o777,
		// 	size: stats.size,
		// 	ino,
		// 	mtimeMs: stats.mtime,
		// 	ctimeMs: stats.ctime,
		// 	uid: 1,
		// 	gid: 1,
		// 	dev: 1,
		// 	isFile: () => stats.type === FileType.File,
		// 	isDirectory: () => stats.type === FileType.Directory,
		// 	isSymbolicLink: () => stats.type === FileType.SymbolicLink,
		// };
	},
};

export const fs: PromiseFsClient = { promises };
