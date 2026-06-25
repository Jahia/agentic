#!/usr/bin/env node
import V, { argv, stdin, stdout } from "node:process";
import { stripVTControlCharacters, styleText } from "node:util";
import "node:readline";
import E from "node:readline";
import "node:tty";
import { accessSync, constants, copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
//#endregion
//#region ../node_modules/fast-string-truncated-width/dist/utils.js
const getCodePointsLength = (() => {
	const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
	return (input) => {
		let surrogatePairsNr = 0;
		SURROGATE_PAIR_RE.lastIndex = 0;
		while (SURROGATE_PAIR_RE.test(input)) surrogatePairsNr += 1;
		return input.length - surrogatePairsNr;
	};
})();
const isFullWidth = (x) => {
	return x === 12288 || x >= 65281 && x <= 65376 || x >= 65504 && x <= 65510;
};
const isWideNotCJKTNotEmoji = (x) => {
	return x === 8987 || x === 9001 || x >= 12272 && x <= 12287 || x >= 12289 && x <= 12350 || x >= 12441 && x <= 12543 || x >= 12549 && x <= 12591 || x >= 12593 && x <= 12686 || x >= 12688 && x <= 12771 || x >= 12783 && x <= 12830 || x >= 12832 && x <= 12871 || x >= 12880 && x <= 19903 || x >= 65040 && x <= 65049 || x >= 65072 && x <= 65106 || x >= 65108 && x <= 65126 || x >= 65128 && x <= 65131 || x >= 127488 && x <= 127490 || x >= 127504 && x <= 127547 || x >= 127552 && x <= 127560 || x >= 131072 && x <= 196605 || x >= 196608 && x <= 262141;
};
//#endregion
//#region ../node_modules/fast-string-truncated-width/dist/index.js
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
const CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
const CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/uy;
const TAB_RE = /\t{1,1000}/y;
const EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,3}\u{E007F}|(?:\p{Emoji}\uFE0F\u20E3?|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation})(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F\u20E3?))*/uy;
const LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
const MODIFIER_RE = /\p{M}+/gu;
const NO_TRUNCATION$1 = {
	limit: Infinity,
	ellipsis: ""
};
const getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
	const LIMIT = truncationOptions.limit ?? Infinity;
	const ELLIPSIS = truncationOptions.ellipsis ?? "";
	const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION$1, widthOptions).width : 0);
	const ANSI_WIDTH = 0;
	const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
	const TAB_WIDTH = widthOptions.tabWidth ?? 8;
	const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
	const FULL_WIDTH_WIDTH = 2;
	const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
	const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
	const PARSE_BLOCKS = [
		[LATIN_RE, REGULAR_WIDTH],
		[ANSI_RE, ANSI_WIDTH],
		[CONTROL_RE, CONTROL_WIDTH],
		[TAB_RE, TAB_WIDTH],
		[EMOJI_RE, EMOJI_WIDTH],
		[CJKT_WIDE_RE, WIDE_WIDTH]
	];
	let indexPrev = 0;
	let index = 0;
	let length = input.length;
	let lengthExtra = 0;
	let truncationEnabled = false;
	let truncationIndex = length;
	let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
	let unmatchedStart = 0;
	let unmatchedEnd = 0;
	let width = 0;
	let widthExtra = 0;
	outer: while (true) {
		if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
			const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
			lengthExtra = 0;
			for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
				const codePoint = char.codePointAt(0) || 0;
				if (isFullWidth(codePoint)) widthExtra = FULL_WIDTH_WIDTH;
				else if (isWideNotCJKTNotEmoji(codePoint)) widthExtra = WIDE_WIDTH;
				else widthExtra = REGULAR_WIDTH;
				if (width + widthExtra > truncationLimit) truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
				if (width + widthExtra > LIMIT) {
					truncationEnabled = true;
					break outer;
				}
				lengthExtra += char.length;
				width += widthExtra;
			}
			unmatchedStart = unmatchedEnd = 0;
		}
		if (index >= length) break outer;
		for (let i = 0, l = PARSE_BLOCKS.length; i < l; i++) {
			const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i];
			BLOCK_RE.lastIndex = index;
			if (BLOCK_RE.test(input)) {
				lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
				widthExtra = lengthExtra * BLOCK_WIDTH;
				if (width + widthExtra > truncationLimit) truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
				if (width + widthExtra > LIMIT) {
					truncationEnabled = true;
					break outer;
				}
				width += widthExtra;
				unmatchedStart = indexPrev;
				unmatchedEnd = index;
				index = indexPrev = BLOCK_RE.lastIndex;
				continue outer;
			}
		}
		index += 1;
	}
	return {
		width: truncationEnabled ? truncationLimit : width,
		index: truncationEnabled ? truncationIndex : length,
		truncated: truncationEnabled,
		ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
	};
};
//#endregion
//#region ../node_modules/fast-string-width/dist/index.js
const NO_TRUNCATION = {
	limit: Infinity,
	ellipsis: "",
	ellipsisWidth: 0
};
const fastStringWidth = (input, options = {}) => {
	return getStringTruncatedWidth(input, NO_TRUNCATION, options).width;
};
//#endregion
//#region ../node_modules/fast-wrap-ansi/lib/main.js
const ESC = "\x1B";
const CSI = "";
const END_CODE = 39;
const ANSI_ESCAPE_BELL = "\x07";
const ANSI_CSI = "[";
const ANSI_OSC = "]";
const ANSI_SGR_TERMINATOR = "m";
const ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
const GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, "y");
const getClosingCode = (openingCode) => {
	if (openingCode >= 30 && openingCode <= 37) return 39;
	if (openingCode >= 90 && openingCode <= 97) return 39;
	if (openingCode >= 40 && openingCode <= 47) return 49;
	if (openingCode >= 100 && openingCode <= 107) return 49;
	if (openingCode === 1 || openingCode === 2) return 22;
	if (openingCode === 3) return 23;
	if (openingCode === 4) return 24;
	if (openingCode === 7) return 27;
	if (openingCode === 8) return 28;
	if (openingCode === 9) return 29;
	if (openingCode === 0) return 0;
};
const wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
const wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
const wrapWord = (rows, word, columns) => {
	const characters = word[Symbol.iterator]();
	let isInsideEscape = false;
	let isInsideLinkEscape = false;
	let lastRow = rows.at(-1);
	let visible = lastRow === void 0 ? 0 : fastStringWidth(lastRow);
	let currentCharacter = characters.next();
	let nextCharacter = characters.next();
	let rawCharacterIndex = 0;
	while (!currentCharacter.done) {
		const character = currentCharacter.value;
		const characterLength = fastStringWidth(character);
		if (visible + characterLength <= columns) rows[rows.length - 1] += character;
		else {
			rows.push(character);
			visible = 0;
		}
		if (character === ESC || character === CSI) {
			isInsideEscape = true;
			isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
		}
		if (isInsideEscape) {
			if (isInsideLinkEscape) {
				if (character === ANSI_ESCAPE_BELL) {
					isInsideEscape = false;
					isInsideLinkEscape = false;
				}
			} else if (character === ANSI_SGR_TERMINATOR) isInsideEscape = false;
		} else {
			visible += characterLength;
			if (visible === columns && !nextCharacter.done) {
				rows.push("");
				visible = 0;
			}
		}
		currentCharacter = nextCharacter;
		nextCharacter = characters.next();
		rawCharacterIndex += character.length;
	}
	lastRow = rows.at(-1);
	if (!visible && lastRow !== void 0 && lastRow.length && rows.length > 1) rows[rows.length - 2] += rows.pop();
};
const stringVisibleTrimSpacesRight = (string) => {
	const words = string.split(" ");
	let last = words.length;
	while (last) {
		if (fastStringWidth(words[last - 1])) break;
		last--;
	}
	if (last === words.length) return string;
	return words.slice(0, last).join(" ") + words.slice(last).join("");
};
const exec = (string, columns, options = {}) => {
	if (options.trim !== false && string.trim() === "") return "";
	let returnValue = "";
	let escapeCode;
	let escapeUrl;
	const words = string.split(" ");
	let rows = [""];
	let rowLength = 0;
	for (let index = 0; index < words.length; index++) {
		const word = words[index];
		if (options.trim !== false) {
			const row = rows.at(-1) ?? "";
			const trimmed = row.trimStart();
			if (row.length !== trimmed.length) {
				rows[rows.length - 1] = trimmed;
				rowLength = fastStringWidth(trimmed);
			}
		}
		if (index !== 0) {
			if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
				rows.push("");
				rowLength = 0;
			}
			if (rowLength || options.trim === false) {
				rows[rows.length - 1] += " ";
				rowLength++;
			}
		}
		const wordLength = fastStringWidth(word);
		if (options.hard && wordLength > columns) {
			const remainingColumns = columns - rowLength;
			const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
			if (Math.floor((wordLength - 1) / columns) < breaksStartingThisLine) rows.push("");
			wrapWord(rows, word, columns);
			rowLength = fastStringWidth(rows.at(-1) ?? "");
			continue;
		}
		if (rowLength + wordLength > columns && rowLength && wordLength) {
			if (options.wordWrap === false && rowLength < columns) {
				wrapWord(rows, word, columns);
				rowLength = fastStringWidth(rows.at(-1) ?? "");
				continue;
			}
			rows.push("");
			rowLength = 0;
		}
		if (rowLength + wordLength > columns && options.wordWrap === false) {
			wrapWord(rows, word, columns);
			rowLength = fastStringWidth(rows.at(-1) ?? "");
			continue;
		}
		rows[rows.length - 1] += word;
		rowLength += wordLength;
	}
	if (options.trim !== false) rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
	const preString = rows.join("\n");
	let inSurrogate = false;
	for (let i = 0; i < preString.length; i++) {
		const character = preString[i];
		returnValue += character;
		if (!inSurrogate) {
			inSurrogate = character >= "\ud800" && character <= "\udbff";
			if (inSurrogate) continue;
		} else inSurrogate = false;
		if (character === ESC || character === CSI) {
			GROUP_REGEX.lastIndex = i + 1;
			const groups = GROUP_REGEX.exec(preString)?.groups;
			if (groups?.code !== void 0) {
				const code = Number.parseFloat(groups.code);
				escapeCode = code === END_CODE ? void 0 : code;
			} else if (groups?.uri !== void 0) escapeUrl = groups.uri.length === 0 ? void 0 : groups.uri;
		}
		if (preString[i + 1] === "\n") {
			if (escapeUrl) returnValue += wrapAnsiHyperlink("");
			const closingCode = escapeCode ? getClosingCode(escapeCode) : void 0;
			if (escapeCode && closingCode) returnValue += wrapAnsiCode(closingCode);
		} else if (character === "\n") {
			if (escapeCode && getClosingCode(escapeCode)) returnValue += wrapAnsiCode(escapeCode);
			if (escapeUrl) returnValue += wrapAnsiHyperlink(escapeUrl);
		}
	}
	return returnValue;
};
const CRLF_OR_LF = /\r?\n/;
function wrapAnsi(string, columns, options) {
	return String(string).normalize().split(CRLF_OR_LF).map((line) => exec(line, columns, options)).join("\n");
}
//#endregion
//#region ../node_modules/@clack/core/dist/index.mjs
var import_src = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const ESC = "\x1B";
	const CSI = `${ESC}[`;
	const beep = "\x07";
	const cursor = {
		to(x, y) {
			if (!y) return `${CSI}${x + 1}G`;
			return `${CSI}${y + 1};${x + 1}H`;
		},
		move(x, y) {
			let ret = "";
			if (x < 0) ret += `${CSI}${-x}D`;
			else if (x > 0) ret += `${CSI}${x}C`;
			if (y < 0) ret += `${CSI}${-y}A`;
			else if (y > 0) ret += `${CSI}${y}B`;
			return ret;
		},
		up: (count = 1) => `${CSI}${count}A`,
		down: (count = 1) => `${CSI}${count}B`,
		forward: (count = 1) => `${CSI}${count}C`,
		backward: (count = 1) => `${CSI}${count}D`,
		nextLine: (count = 1) => `${CSI}E`.repeat(count),
		prevLine: (count = 1) => `${CSI}F`.repeat(count),
		left: `${CSI}G`,
		hide: `${CSI}?25l`,
		show: `${CSI}?25h`,
		save: `${ESC}7`,
		restore: `${ESC}8`
	};
	module.exports = {
		cursor,
		scroll: {
			up: (count = 1) => `${CSI}S`.repeat(count),
			down: (count = 1) => `${CSI}T`.repeat(count)
		},
		erase: {
			screen: `${CSI}2J`,
			up: (count = 1) => `${CSI}1J`.repeat(count),
			down: (count = 1) => `${CSI}J`.repeat(count),
			line: `${CSI}2K`,
			lineEnd: `${CSI}K`,
			lineStart: `${CSI}1K`,
			lines(count) {
				let clear = "";
				for (let i = 0; i < count; i++) clear += this.line + (i < count - 1 ? cursor.up() : "");
				if (count) clear += cursor.left;
				return clear;
			}
		},
		beep
	};
})))();
function f(r, t, s) {
	if (!s.some((o) => !o.disabled)) return r;
	const e = r + t, i = Math.max(s.length - 1, 0), n = e < 0 ? i : e > i ? 0 : e;
	return s[n].disabled ? f(n, t < 0 ? -1 : 1, s) : n;
}
const h = {
	actions: new Set([
		"up",
		"down",
		"left",
		"right",
		"space",
		"enter",
		"cancel"
	]),
	aliases: new Map([
		["k", "up"],
		["j", "down"],
		["h", "left"],
		["l", "right"],
		["", "cancel"],
		["escape", "cancel"]
	]),
	messages: {
		cancel: "Canceled",
		error: "Something went wrong"
	},
	withGuide: !0,
	date: {
		monthNames: [...[
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		]],
		messages: {
			required: "Please enter a valid date",
			invalidMonth: "There are only 12 months in a year",
			invalidDay: (r, t) => `There are only ${r} days in ${t}`,
			afterMin: (r) => `Date must be on or after ${r.toISOString().slice(0, 10)}`,
			beforeMax: (r) => `Date must be on or before ${r.toISOString().slice(0, 10)}`
		}
	}
};
function C(r, t) {
	if (typeof r == "string") return h.aliases.get(r) === t;
	for (const s of r) if (s !== void 0 && C(s, t)) return !0;
	return !1;
}
function z$1(r, t) {
	if (r === t) return;
	const s = r.split(`
`), e = t.split(`
`), i = Math.max(s.length, e.length), n = [];
	for (let o = 0; o < i; o++) s[o] !== e[o] && n.push(o);
	return {
		lines: n,
		numLinesBefore: s.length,
		numLinesAfter: e.length,
		numLines: i
	};
}
globalThis.process.platform.startsWith("win");
const k = Symbol("clack:cancel");
function q$1(r) {
	return r === k;
}
function w$1(r, t) {
	const s = r;
	s.isTTY && s.setRawMode(t);
}
const A = (r) => "columns" in r && typeof r.columns == "number" ? r.columns : 80, L = (r) => "rows" in r && typeof r.rows == "number" ? r.rows : 20;
function W(r, t, s, e = s, i = s, n) {
	return wrapAnsi(t, A(r ?? stdout) - s.length, {
		hard: !0,
		trim: !1
	}).split(`
`).map((u, a, l) => {
		const c = n ? n(u, a) : u;
		return a === 0 ? `${e}${c}` : a === l.length - 1 ? `${i}${c}` : `${s}${c}`;
	}).join(`
`);
}
let m = class {
	input;
	output;
	_abortSignal;
	rl;
	opts;
	_render;
	_track = !1;
	_prevFrame = "";
	_subscribers = /* @__PURE__ */ new Map();
	_cursor = 0;
	state = "initial";
	error = "";
	value;
	userInput = "";
	constructor(t, s = !0) {
		const { input: e = stdin, output: i = stdout, render: n, signal: o, ...u } = t;
		this.opts = u, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = n.bind(this), this._track = s, this._abortSignal = o, this.input = e, this.output = i;
	}
	unsubscribe() {
		this._subscribers.clear();
	}
	setSubscriber(t, s) {
		const e = this._subscribers.get(t) ?? [];
		e.push(s), this._subscribers.set(t, e);
	}
	on(t, s) {
		this.setSubscriber(t, { cb: s });
	}
	once(t, s) {
		this.setSubscriber(t, {
			cb: s,
			once: !0
		});
	}
	emit(t, ...s) {
		const e = this._subscribers.get(t) ?? [], i = [];
		for (const n of e) n.cb(...s), n.once && i.push(() => e.splice(e.indexOf(n), 1));
		for (const n of i) n();
	}
	prompt() {
		return new Promise((t) => {
			if (this._abortSignal) {
				if (this._abortSignal.aborted) return this.state = "cancel", this.close(), t(k);
				this._abortSignal.addEventListener("abort", () => {
					this.state = "cancel", this.close();
				}, { once: !0 });
			}
			this.rl = E.createInterface({
				input: this.input,
				tabSize: 2,
				prompt: "",
				escapeCodeTimeout: 50,
				terminal: !0
			}), this.rl.prompt(), this.opts.initialUserInput !== void 0 && this._setUserInput(this.opts.initialUserInput, !0), this.input.on("keypress", this.onKeypress), w$1(this.input, !0), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
				this.output.write(import_src.cursor.show), this.output.off("resize", this.render), w$1(this.input, !1), t(this.value);
			}), this.once("cancel", () => {
				this.output.write(import_src.cursor.show), this.output.off("resize", this.render), w$1(this.input, !1), t(k);
			});
		});
	}
	_isActionKey(t, s) {
		return t === "	";
	}
	_shouldSubmit(t, s) {
		return !0;
	}
	_setValue(t) {
		this.value = t, this.emit("value", this.value);
	}
	_setUserInput(t, s) {
		this.userInput = t ?? "", this.emit("userInput", this.userInput), s && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
	}
	_clearUserInput() {
		this.rl?.write(null, {
			ctrl: !0,
			name: "u"
		}), this._setUserInput("");
	}
	onKeypress(t, s) {
		if (this._track && s.name !== "return" && (s.name && this._isActionKey(t, s) && this.rl?.write(null, {
			ctrl: !0,
			name: "h"
		}), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), s?.name && (!this._track && h.aliases.has(s.name) && this.emit("cursor", h.aliases.get(s.name)), h.actions.has(s.name) && this.emit("cursor", s.name)), t && (t.toLowerCase() === "y" || t.toLowerCase() === "n") && this.emit("confirm", t.toLowerCase() === "y"), this.emit("key", t?.toLowerCase(), s), s?.name === "return" && this._shouldSubmit(t, s)) {
			if (this.opts.validate) {
				const e = this.opts.validate(this.value);
				e && (this.error = e instanceof Error ? e.message : e, this.state = "error", this.rl?.write(this.userInput));
			}
			this.state !== "error" && (this.state = "submit");
		}
		C([
			t,
			s?.name,
			s?.sequence
		], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
	}
	close() {
		this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), w$1(this.input, !1), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
	}
	restoreCursor() {
		const t = wrapAnsi(this._prevFrame, process.stdout.columns, {
			hard: !0,
			trim: !1
		}).split(`
`).length - 1;
		this.output.write(import_src.cursor.move(-999, t * -1));
	}
	render() {
		const t = wrapAnsi(this._render(this) ?? "", process.stdout.columns, {
			hard: !0,
			trim: !1
		});
		if (t !== this._prevFrame) {
			if (this.state === "initial") this.output.write(import_src.cursor.hide);
			else {
				const s = z$1(this._prevFrame, t), e = L(this.output);
				if (this.restoreCursor(), s) {
					const i = Math.max(0, s.numLinesAfter - e), n = Math.max(0, s.numLinesBefore - e);
					let o = s.lines.find((u) => u >= i);
					if (o === void 0) {
						this._prevFrame = t;
						return;
					}
					if (s.lines.length === 1) {
						this.output.write(import_src.cursor.move(0, o - n)), this.output.write(import_src.erase.lines(1));
						const u = t.split(`
`);
						this.output.write(u[o]), this._prevFrame = t, this.output.write(import_src.cursor.move(0, u.length - o - 1));
						return;
					} else if (s.lines.length > 1) {
						if (i < n) o = i;
						else {
							const a = o - n;
							a > 0 && this.output.write(import_src.cursor.move(0, a));
						}
						this.output.write(import_src.erase.down());
						const u = t.split(`
`).slice(o);
						this.output.write(u.join(`
`)), this._prevFrame = t;
						return;
					}
				}
				this.output.write(import_src.erase.down());
			}
			this.output.write(t), this.state === "initial" && (this.state = "active"), this._prevFrame = t;
		}
	}
};
var X = class extends m {
	get cursor() {
		return this.value ? 0 : 1;
	}
	get _value() {
		return this.cursor === 0;
	}
	constructor(t) {
		super(t, !1), this.value = !!t.initialValue, this.on("userInput", () => {
			this.value = this._value;
		}), this.on("confirm", (s) => {
			this.output.write(import_src.cursor.move(0, -1)), this.value = s, this.state = "submit", this.close();
		}), this.on("cursor", () => {
			this.value = !this.value;
		});
	}
};
var ut$1 = class extends m {
	options;
	cursor = 0;
	get _selectedValue() {
		return this.options[this.cursor];
	}
	changeValue() {
		this.value = this._selectedValue.value;
	}
	constructor(t) {
		super(t, !1), this.options = t.options;
		const s = this.options.findIndex(({ value: i }) => i === t.initialValue), e = s === -1 ? 0 : s;
		this.cursor = this.options[e].disabled ? f(e, 1, this.options) : e, this.changeValue(), this.on("cursor", (i) => {
			switch (i) {
				case "left":
				case "up":
					this.cursor = f(this.cursor, -1, this.options);
					break;
				case "down":
				case "right":
					this.cursor = f(this.cursor, 1, this.options);
					break;
			}
			this.changeValue();
		});
	}
};
//#endregion
//#region ../node_modules/@clack/prompts/dist/index.mjs
function ee() {
	return V.platform !== "win32" ? V.env.TERM !== "linux" : !!V.env.CI || !!V.env.WT_SESSION || !!V.env.TERMINUS_SUBLIME || V.env.ConEmuTask === "{cmd::Cmder}" || V.env.TERM_PROGRAM === "Terminus-Sublime" || V.env.TERM_PROGRAM === "vscode" || V.env.TERM === "xterm-256color" || V.env.TERM === "alacritty" || V.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
const tt = ee(), w = (t, i) => tt ? t : i, Tt = w("◆", "*"), at = w("■", "x"), ut = w("▲", "x"), H = w("◇", "o"), lt = w("┌", "T"), $ = w("│", "|"), x = w("└", "—");
const z = w("●", ">"), U = w("○", " ");
const ht = w("●", "•"), pt = w("◆", "*"), mt = w("▲", "!"), gt = w("■", "x"), P = (t) => {
	switch (t) {
		case "initial":
		case "active": return styleText("cyan", Tt);
		case "cancel": return styleText("red", at);
		case "error": return styleText("yellow", ut);
		case "submit": return styleText("green", H);
	}
}, yt = (t) => {
	switch (t) {
		case "initial":
		case "active": return styleText("cyan", $);
		case "cancel": return styleText("red", $);
		case "error": return styleText("yellow", $);
		case "submit": return styleText("green", $);
	}
}, Ot = (t, i, s, r, u, n = !1) => {
	let a = i, c = 0;
	if (n) for (let o = r - 1; o >= s && (a -= t[o].length, c++, !(a <= u)); o--);
	else for (let o = s; o < r && (a -= t[o].length, c++, !(a <= u)); o++);
	return {
		lineCount: a,
		removals: c
	};
}, F = ({ cursor: t, options: i, style: s, output: r = process.stdout, maxItems: u = Number.POSITIVE_INFINITY, columnPadding: n = 0, rowPadding: a = 4 }) => {
	const c = A(r) - n, o = L(r), l = styleText("dim", "..."), d = Math.max(o - a, 0), g = Math.max(Math.min(u, d), 5);
	let p = 0;
	t >= g - 3 && (p = Math.max(Math.min(t - g + 3, i.length - g), 0));
	let f = g < i.length && p > 0, h = g < i.length && p + g < i.length;
	const I = Math.min(p + g, i.length), m = [];
	let y = 0;
	f && y++, h && y++;
	const v = p + (f ? 1 : 0), C = I - (h ? 1 : 0);
	for (let b = v; b < C; b++) {
		const G = wrapAnsi(s(i[b], b === t), c, {
			hard: !0,
			trim: !1
		}).split(`
`);
		m.push(G), y += G.length;
	}
	if (y > d) {
		let b = 0, G = 0, M = y;
		const N = t - v;
		let O = d;
		const j = () => Ot(m, M, 0, N, O), k = () => Ot(m, M, N + 1, m.length, O, !0);
		f ? ({lineCount: M, removals: b} = j(), M > O && (h || (O -= 1), {lineCount: M, removals: G} = k())) : (h || (O -= 1), {lineCount: M, removals: G} = k(), M > O && (O -= 1, {lineCount: M, removals: b} = j())), b > 0 && (f = !0, m.splice(0, b)), G > 0 && (h = !0, m.splice(m.length - G, G));
	}
	const S = [];
	f && S.push(l);
	for (const b of m) for (const G of b) S.push(G);
	return h && S.push(l), S;
};
const ue = (t) => {
	const i = t.active ?? "Yes", s = t.inactive ?? "No";
	return new X({
		active: i,
		inactive: s,
		signal: t.signal,
		input: t.input,
		output: t.output,
		initialValue: t.initialValue ?? !0,
		render() {
			const r = t.withGuide ?? h.withGuide, u = `${P(this.state)}  `, n = r ? `${styleText("gray", $)}  ` : "", a = W(t.output, t.message, n, u), c = `${r ? `${styleText("gray", $)}
` : ""}${a}
`, o = this.value ? i : s;
			switch (this.state) {
				case "submit": return `${c}${r ? `${styleText("gray", $)}  ` : ""}${styleText("dim", o)}`;
				case "cancel": return `${c}${r ? `${styleText("gray", $)}  ` : ""}${styleText(["strikethrough", "dim"], o)}${r ? `
${styleText("gray", $)}` : ""}`;
				default: {
					const l = r ? `${styleText("cyan", $)}  ` : "", d = r ? styleText("cyan", x) : "";
					return `${c}${l}${this.value ? `${styleText("green", z)} ${i}` : `${styleText("dim", U)} ${styleText("dim", i)}`}${t.vertical ? r ? `
${styleText("cyan", $)}  ` : `
` : ` ${styleText("dim", "/")} `}${this.value ? `${styleText("dim", U)} ${styleText("dim", s)}` : `${styleText("green", z)} ${s}`}
${d}
`;
				}
			}
		}
	}).prompt();
}, R = {
	message: (t = [], { symbol: i = styleText("gray", $), secondarySymbol: s = styleText("gray", $), output: r = process.stdout, spacing: u = 1, withGuide: n } = {}) => {
		const a = [], c = n ?? h.withGuide, o = c ? s : "", l = c ? `${i}  ` : "", d = c ? `${s}  ` : "";
		for (let p = 0; p < u; p++) a.push(o);
		const g = Array.isArray(t) ? t : t.split(`
`);
		if (g.length > 0) {
			const [p, ...f] = g;
			p.length > 0 ? a.push(`${l}${p}`) : a.push(c ? i : "");
			for (const h of f) h.length > 0 ? a.push(`${d}${h}`) : a.push(c ? s : "");
		}
		r.write(`${a.join(`
`)}
`);
	},
	info: (t, i) => {
		R.message(t, {
			...i,
			symbol: styleText("blue", ht)
		});
	},
	success: (t, i) => {
		R.message(t, {
			...i,
			symbol: styleText("green", pt)
		});
	},
	step: (t, i) => {
		R.message(t, {
			...i,
			symbol: styleText("green", H)
		});
	},
	warn: (t, i) => {
		R.message(t, {
			...i,
			symbol: styleText("yellow", mt)
		});
	},
	warning: (t, i) => {
		R.warn(t, i);
	},
	error: (t, i) => {
		R.message(t, {
			...i,
			symbol: styleText("red", gt)
		});
	}
}, me = (t = "", i) => {
	const s = i?.output ?? process.stdout, r = i?.withGuide ?? h.withGuide ? `${styleText("gray", x)}  ` : "";
	s.write(`${r}${styleText("red", t)}

`);
}, ge = (t = "", i) => {
	const s = i?.output ?? process.stdout, r = i?.withGuide ?? h.withGuide ? `${styleText("gray", lt)}  ` : "";
	s.write(`${r}${t}
`);
}, ye = (t = "", i) => {
	const s = i?.output ?? process.stdout, r = i?.withGuide ?? h.withGuide ? `${styleText("gray", $)}
${styleText("gray", x)}  ` : "";
	s.write(`${r}${t}

`);
}, it = (t, i) => t.includes(`
`) ? t.split(`
`).map((s) => i(s)).join(`
`) : i(t), xe = (t) => {
	const i = (s, r) => {
		const u = s.label ?? String(s.value);
		switch (r) {
			case "disabled": return `${styleText("gray", U)} ${it(u, (n) => styleText("gray", n))}${s.hint ? ` ${styleText("dim", `(${s.hint ?? "disabled"})`)}` : ""}`;
			case "selected": return `${it(u, (n) => styleText("dim", n))}`;
			case "active": return `${styleText("green", z)} ${u}${s.hint ? ` ${styleText("dim", `(${s.hint})`)}` : ""}`;
			case "cancelled": return `${it(u, (n) => styleText(["strikethrough", "dim"], n))}`;
			default: return `${styleText("dim", U)} ${it(u, (n) => styleText("dim", n))}`;
		}
	};
	return new ut$1({
		options: t.options,
		signal: t.signal,
		input: t.input,
		output: t.output,
		initialValue: t.initialValue,
		render() {
			const s = t.withGuide ?? h.withGuide, r = `${P(this.state)}  `, u = `${yt(this.state)}  `, n = W(t.output, t.message, u, r), a = `${s ? `${styleText("gray", $)}
` : ""}${n}
`;
			switch (this.state) {
				case "submit": {
					const c = s ? `${styleText("gray", $)}  ` : "";
					return `${a}${W(t.output, i(this.options[this.cursor], "selected"), c)}`;
				}
				case "cancel": {
					const c = s ? `${styleText("gray", $)}  ` : "";
					return `${a}${W(t.output, i(this.options[this.cursor], "cancelled"), c)}${s ? `
${styleText("gray", $)}` : ""}`;
				}
				default: {
					const c = s ? `${styleText("cyan", $)}  ` : "", o = s ? styleText("cyan", x) : "", l = a.split(`
`).length, d = s ? 2 : 1;
					return `${a}${c}${F({
						output: t.output,
						cursor: this.cursor,
						options: this.options,
						maxItems: t.maxItems,
						columnPadding: c.length,
						rowPadding: l + d,
						style: (g, p) => i(g, g.disabled ? "disabled" : p ? "active" : "inactive")
					}).join(`
${c}`)}
${o}
`;
				}
			}
		}
	}).prompt();
}, Nt = `${styleText("gray", $)}  `, q = {
	message: async (t, { symbol: i = styleText("gray", $) } = {}) => {
		process.stdout.write(`${styleText("gray", $)}
${i}  `);
		let s = 3;
		for await (let r of t) {
			r = r.replace(/\n/g, `
${Nt}`), r.includes(`
`) && (s = 3 + stripVTControlCharacters(r.slice(r.lastIndexOf(`
`))).length);
			const u = stripVTControlCharacters(r).length;
			s + u < process.stdout.columns ? (s += u, process.stdout.write(r)) : (process.stdout.write(`
${Nt}${r.trimStart()}`), s = 3 + stripVTControlCharacters(r.trimStart()).length);
		}
		process.stdout.write(`
`);
	},
	info: (t) => q.message(t, { symbol: styleText("blue", ht) }),
	success: (t) => q.message(t, { symbol: styleText("green", pt) }),
	step: (t) => q.message(t, { symbol: styleText("green", H) }),
	warn: (t) => q.message(t, { symbol: styleText("yellow", mt) }),
	warning: (t) => q.warn(t),
	error: (t) => q.message(t, { symbol: styleText("red", gt) })
};
//#endregion
//#region cli/index.ts
const targets = [
	"claude",
	"copilot",
	"cursor",
	"codex",
	"gemini",
	"opencode",
	"windsurf"
];
let target = argv[2];
const interactive = !target;
ge("@jahia/agentic");
R.message("The goal of this CLI is to provide a fully functional harness for agentic development of Jahia modules.");
if (!target) {
	R.info(`You skip this prompt by running ${styleText("blueBright", "npx @jahia/agentic@latest <agent>")}`);
	const gitStatus = spawnSync("git", ["status", "--porcelain"], { encoding: "utf-8" });
	if (gitStatus.error) R.error(`Failed to check git status: ${gitStatus.error.message}`);
	if (gitStatus.stdout.trim() !== "") {
		R.warn("You have uncommitted changes in your workspace. It's safer to run this CLI on a clean workspace to avoid losing work.");
		const confirm = await ue({ message: "Do you want to continue?" });
		if (!confirm || q$1(confirm)) {
			me("Come back soon!");
			process.exit(0);
		}
	}
	target = await xe({
		message: "Which agent do you use?",
		options: [
			{
				value: "claude",
				label: "Claude",
				hint: "Will create CLAUDE.md and .claude/"
			},
			{
				value: "codex",
				label: "Codex",
				hint: "Will create AGENTS.md and .agents/"
			},
			{
				value: "copilot",
				label: "Copilot",
				hint: "Will create AGENTS.md, .agents/ and .github/"
			},
			{
				value: "cursor",
				label: "Cursor",
				hint: "Will create .agents/ and .cursor/"
			},
			{
				value: "gemini",
				label: "Gemini",
				hint: "Will create AGENTS.md, GEMINI.md and .agents/"
			},
			{
				value: "opencode",
				label: "OpenCode",
				hint: "Will create AGENTS.md and .agents/"
			},
			{
				value: "windsurf",
				label: "Windsurf",
				hint: "Will create AGENTS.md and .windsurf/"
			}
		]
	});
	if (q$1(target)) {
		me("Come back soon!");
		process.exit(0);
	}
}
if (!targets.includes(target)) {
	me(`Invalid target: ${target}\nValid targets are: ${targets.join(", ")}`);
	process.exit(1);
}
const src = resolve(import.meta.dirname, target);
const dst = process.cwd();
const entries = readdirSync(src, {
	withFileTypes: true,
	recursive: true
});
const dirsToCreate = /* @__PURE__ */ new Set();
const filesToCopy = [];
for (const entry of entries) {
	if (!entry.isFile()) continue;
	const relativePath = entry.parentPath.substring(src.length + 1);
	dirsToCreate.add(resolve(dst, relativePath));
	filesToCopy.push({
		src: resolve(entry.parentPath, entry.name),
		dst: resolve(dst, relativePath, entry.name)
	});
}
for (const dir of dirsToCreate) if (statSync(dir, { throwIfNoEntry: false })?.isFile()) {
	me(`Cannot create directory ${dir} because a file with the same name exists.`);
	process.exit(1);
}
let overwriteCount = 0;
for (const { src, dst } of filesToCopy) try {
	accessSync(dst, constants.R_OK | constants.W_OK);
	if (readFileSync(dst, "utf-8") !== readFileSync(src, "utf-8")) overwriteCount++;
} catch {}
if (interactive && overwriteCount > 0) {
	const confirm = await ue({ message: `There are ${overwriteCount} file${overwriteCount >= 2 ? "s" : ""} that will be overwritten. Do you want to continue?` });
	if (!confirm || q$1(confirm)) {
		me("Come back soon!");
		process.exit(0);
	}
} else if (overwriteCount > 0) R.warn(`Harness already exists, ${overwriteCount} file${overwriteCount >= 2 ? "s" : ""} will be overwritten.`);
for (const dir of dirsToCreate) mkdirSync(dir, { recursive: true });
for (const { src, dst } of filesToCopy) copyFileSync(src, dst);
ye(`Harness created successfully!

To update the harness in the future, run ${styleText("blueBright", "npx @jahia/agentic@latest " + target)}`);
//#endregion
export {};
