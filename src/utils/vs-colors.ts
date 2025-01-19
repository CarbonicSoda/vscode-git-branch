import { ColorThemeKind, ThemeColor, window } from "vscode";

import VSCodeColors from "../json/vscode-colors.json";

/**
 * Functions to return {@link ThemeColor} from sRGB or string-hash
 */
export namespace VSColors {
	const VSCodeColorsRgb: { [themeKind: string]: { [colorName: string]: RGB3 } } = {};
	for (const [themeKind, colors] of Object.entries(VSCodeColors)) {
		VSCodeColorsRgb[themeKind] = {};
		for (const [colorName, hex] of Object.entries(colors)) {
			VSCodeColorsRgb[themeKind][colorName] = hexToRgb(hex);
		}
	}

	/**
	 * RGB entry
	 */
	export type RGB3 = [R: number, G: number, B: number];

	/**
	 * @returns the closest {@link ThemeColor} to `rgbOrHex`, interpolated in sRGB color space
	 *
	 * The colors would differ slightly within color themes of the same {@link ColorThemeKind} `(dark/light/hc_dark/hc_light)`,
	 * under different theme kinds the result would differ significantly, **INTENDED** for higher contrast
	 *
	 * A demo of original & filtered colors could be seen at https://www.desmos.com/3d/wt60c3p2mk,
	 * do note that the "filtered" colors also include some now removed colors, details below
	 *
	 * Colors are based upon default vscode color themes, so custom color themes might cause colors to
	 * completely lack contrast. If a color is found to be contrast-less in popular themes, **FILE AN ISSUE**,
	 * I have removed several colors found contrast-less in my fave theme `Catppuccin Latte`, which is a light theme,
	 * so light themes have less colors, and contrast-less colors in other themes might be overlooked LOL
	 *
	 * @param RGBorHEX `RGB3`: [R, G, B], `"#rrggbb"` or `"#rgb"` (case insensitive, "#" could be omitted)
	 */
	export function interpolate(RGBorHEX: RGB3 | string): ThemeColor {
		const rgb = typeof RGBorHEX === "string" ? hexToRgb(RGBorHEX) : RGBorHEX;
		const colorThemeKind = ColorThemeKind[window.activeColorTheme.kind];
		let bestDist = Number.MAX_SAFE_INTEGER;
		let best = "";
		for (const [colorName, colorRgb] of Object.entries(
			VSCodeColorsRgb[<keyof typeof VSCodeColorsRgb>colorThemeKind],
		)) {
			let dist = 0;
			for (let i = 0; i < 3; i++) dist += (rgb[i] - colorRgb[i]) ** 2;
			if (dist < bestDist) {
				bestDist = dist;
				best = colorName;
			}
		}
		return new ThemeColor(best);
	}

	/**
	 * @returns a {@link ThemeColor} for `hashString` which will not change over sessions or devices
	 *
	 * Since colors are limited to the higher-constrast sRGB half-cube,
	 * colors hashed to the other half-cube might be interpolated to very similar colors,
	 * and I'm too dumb ~~lazy~~ to fix that
	 */
	export function hash(hashString: string): ThemeColor {
		const rgb = sRGBhash(hashString);
		return interpolate(rgb);
	}

	/**
	 * @returns a definite rgb for `hashString`, like a hash function
	 *
	 * Hash function is from https://github.com/RolandR/ColorHash
	 * modified to make permutations of characters to give different colors
	 */
	function sRGBhash(hashString: string): RGB3 {
		let sum = 0;
		for (let i = 0; i < hashString.length; i++) sum += hashString.charCodeAt(i) * (i + 1);
		const getVal = (param: number) => Math.trunc(Number(`0.${String(Math.sin(sum + param)).slice(6)}`) * 256);
		return [getVal(1), getVal(2), getVal(3)];
	}

	/**
	 * Converts `hex` to `RGB3`
	 * @param hex `"#rrggbb"` or `"#rgb"` (case insensitive, "#" could be omitted)
	 */
	function hexToRgb(hex: string): RGB3 {
		hex = hex.replace("#", "");
		if (hex.length === 3) hex = hex[0].repeat(2) + hex[1].repeat(2) + hex[2].repeat(2);
		return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
	}
}
