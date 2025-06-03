import Fs from "node:fs";

import type IsoFs from "@isomorphic-git/lightning-fs";
import { type PromiseFsClient } from "isomorphic-git";

export const fs: PromiseFsClient =
	"prototype" in Fs ? new (Fs as unknown as typeof IsoFs)("fs") : Fs;
