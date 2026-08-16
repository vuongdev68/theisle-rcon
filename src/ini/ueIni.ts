export const SESSION_SECTION = "/Script/TheIsle.TIGameSession";
export const STATE_SECTION = "/Script/TheIsle.TIGameStateBase";

const CLASS_NAME = /^[A-Za-z0-9_]+$/;
const STEAM_ID = /^\d+$/;
const AI_CLASS = /^[^=[\]()"\r\n]+$/;

export function tryGetSectionName(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("[")) {
    return undefined;
  }
  const close = trimmed.indexOf("]");
  if (close < 1) {
    return undefined;
  }
  const name = trimmed.slice(1, close).trim();
  return name.length > 0 ? name : undefined;
}

export function isSectionHeader(line: string, section: string): boolean {
  const name = tryGetSectionName(line);
  return name !== undefined && name.toLowerCase() === section.toLowerCase();
}

export function tryMatchIniKey(trimmedLine: string, key: string): string | undefined {
  let line = trimmedLine;
  if (line.startsWith("+")) {
    line = line.slice(1).trimStart();
  }
  if (!line.toLowerCase().startsWith(key.toLowerCase())) {
    return undefined;
  }
  let i = key.length;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) {
    i += 1;
  }
  if (i >= line.length || line[i] !== "=") {
    return undefined;
  }
  return line.slice(i + 1).trim();
}

export function getConfigValue(content: string, key: string, section?: string): string | undefined {
  let currentSection: string | undefined;
  let lastMatch: string | undefined;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    const header = tryGetSectionName(line);
    if (header !== undefined) {
      currentSection = header;
      continue;
    }
    if (section && currentSection?.toLowerCase() !== section.toLowerCase()) {
      continue;
    }
    const matched = tryMatchIniKey(line, key);
    if (matched === undefined) {
      continue;
    }
    let value = matched.trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    lastMatch = value.trim();
  }
  return lastMatch;
}

export function getBoolValue(content: string, key: string, section?: string, defaultValue = false): boolean {
  const value = getConfigValue(content, key, section);
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true" || value === "1";
}

export function readIniValuesInSections(content: string, key: string, sections: string[]): string[] {
  const wanted = new Set(sections.map((item) => item.toLowerCase()));
  const results: string[] = [];
  let currentSection: string | undefined;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    const header = tryGetSectionName(line);
    if (header !== undefined) {
      currentSection = header;
      continue;
    }
    if (!currentSection || !wanted.has(currentSection.toLowerCase())) {
      continue;
    }
    const value = tryMatchIniKey(line, key);
    if (value !== undefined) {
      results.push(value);
    }
  }
  return results;
}

export function splitIniEntries(
  rawValues: string[],
  pattern: RegExp,
): { recognised: string[]; preserved: string[] } {
  const recognised: string[] = [];
  const preserved: string[] = [];
  for (const value of rawValues) {
    for (const part of value.split(",")) {
      const original = part.trim();
      const entry = original.replace(/^[("]+/, "").replace(/[)"]+$/, "").trim();
      if (!entry) {
        continue;
      }
      if (pattern.test(entry)) {
        recognised.push(entry);
      } else {
        preserved.push(original);
      }
    }
  }
  return { recognised, preserved };
}

export function readIdList(content: string, key: string, section: string): string[] {
  return [...new Set(splitIniEntries(readIniValuesInSections(content, key, [section]), STEAM_ID).recognised)];
}

export function readClassList(content: string, key: string, section: string): string[] {
  return splitIniEntries(readIniValuesInSections(content, key, [section]), CLASS_NAME).recognised;
}

export function readAiList(content: string, key: string, sections: string[]): string[] {
  return [
    ...new Set(
      splitIniEntries(readIniValuesInSections(content, key, sections), AI_CLASS).recognised.map(migrateAiName).filter(Boolean),
    ),
  ];
}

export function preservedEntries(content: string, key: string, sections: string[], pattern: RegExp): string[] {
  return splitIniEntries(readIniValuesInSections(content, key, sections), pattern).preserved.map((value) => `${key}=${value}`);
}

export function migrateAiName(name: string): string {
  const map: Record<string, string> = {
    chickens: "Chicken",
    turtles: "SeaTurtle",
    "frogs/toads": "Bullfrog",
    crabs: "Crab",
  };
  if (name.toLowerCase() === "various fish") {
    return "";
  }
  return map[name.toLowerCase()] ?? name;
}

export function updateIniValue(lines: string[], section: string, key: string, value: string | undefined): void {
  let sectionIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isSectionHeader(lines[i] ?? "", section)) {
      sectionIdx = i;
      break;
    }
  }
  if (sectionIdx === -1) {
    if (value === undefined) {
      return;
    }
    if (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() !== "") {
      lines.push("");
    }
    lines.push(`[${section}]`);
    lines.push(`${key}=${value}`);
    return;
  }

  const keyIdxs: number[] = [];
  let endOfFirstBlock = lines.length;
  let inSection = false;
  for (let i = sectionIdx; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    if (tryGetSectionName(line) !== undefined) {
      inSection = isSectionHeader(lines[i] ?? "", section);
      if (!inSection && endOfFirstBlock === lines.length && i > sectionIdx) {
        endOfFirstBlock = i;
      }
      continue;
    }
    if (inSection && tryMatchIniKey(line, key) !== undefined) {
      keyIdxs.push(i);
    }
  }

  let keepIdx = keyIdxs.length > 0 ? (keyIdxs[keyIdxs.length - 1] ?? -1) : -1;
  for (let k = keyIdxs.length - 2; k >= 0; k -= 1) {
    const idx = keyIdxs[k] ?? 0;
    lines.splice(idx, 1);
    if (idx < keepIdx) {
      keepIdx -= 1;
    }
    if (idx < endOfFirstBlock) {
      endOfFirstBlock -= 1;
    }
  }

  if (value === undefined) {
    if (keepIdx !== -1) {
      lines.splice(keepIdx, 1);
    }
    return;
  }
  if (keepIdx !== -1) {
    lines[keepIdx] = `${key}=${value}`;
    return;
  }
  lines.splice(endOfFirstBlock, 0, `${key}=${value}`);
}

export function updateIniList(lines: string[], section: string, keyPrefix: string, newValues: string[]): void {
  let firstSectionIdx = -1;
  const staleKeyLines: number[] = [];
  let inSection = false;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? "").trim();
    if (tryGetSectionName(trimmed) !== undefined) {
      inSection = isSectionHeader(lines[i] ?? "", section);
      if (inSection && firstSectionIdx === -1) {
        firstSectionIdx = i;
      }
      continue;
    }
    if (inSection && tryMatchIniKey(trimmed, keyPrefix) !== undefined) {
      staleKeyLines.push(i);
    }
  }

  if (firstSectionIdx === -1) {
    if (newValues.length === 0) {
      return;
    }
    if (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() !== "") {
      lines.push("");
    }
    lines.push(`[${section}]`);
    lines.push(...newValues);
    return;
  }

  let insertAt = lines.length;
  for (let i = firstSectionIdx + 1; i < lines.length; i += 1) {
    if (tryGetSectionName(lines[i] ?? "") !== undefined) {
      insertAt = i;
      break;
    }
  }
  for (let k = staleKeyLines.length - 1; k >= 0; k -= 1) {
    const idx = staleKeyLines[k] ?? 0;
    lines.splice(idx, 1);
    if (idx < insertAt) {
      insertAt -= 1;
    }
  }
  lines.splice(insertAt, 0, ...newValues);
}

export const classNamePattern = CLASS_NAME;
export const steamIdPattern = STEAM_ID;
export const aiClassPattern = AI_CLASS;
