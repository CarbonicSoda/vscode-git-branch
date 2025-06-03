import Fs from "node:fs";

import type IsoFs from "@isomorphic-git/lightning-fs";
import { type PromiseFsClient } from "isomorphic-git";

// lightning-fs would be alias for node:fs in web extension and Fs would be of type IsoFs
export const fs: PromiseFsClient =
	"prototype" in Fs ? new (Fs as unknown as typeof IsoFs)("fs") : Fs;
