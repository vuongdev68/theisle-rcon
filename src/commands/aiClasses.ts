/**
 * Wildlife AI classes: developer Game.ini comments plus the Evrima Server Launcher roster.
 */
export const KnownAIClasses = [
  { name: "Compsognathus", kind: "small carnivore" },
  { name: "Pterodactylus", kind: "flying" },
  { name: "Psittacosaurus", kind: "prey" },
  { name: "Boar", kind: "prey" },
  { name: "Deer", kind: "prey" },
  { name: "Goat", kind: "prey" },
  { name: "Rabbit", kind: "prey" },
  { name: "Chicken", kind: "prey" },
  { name: "Seaturtle", kind: "aquatic" },
  { name: "SeaTurtle", kind: "aquatic" },
  { name: "Bullfrog", kind: "prey" },
  { name: "Crab", kind: "prey" },
] as const;

export type KnownAIClassName = (typeof KnownAIClasses)[number]["name"];

const knownNames = new Set<string>(KnownAIClasses.map((item) => item.name.toLowerCase()));

export function isKnownAIClass(name: string): boolean {
  return knownNames.has(name.trim().toLowerCase());
}

export function isValidAIClassName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(name.trim());
}

export function filterKnownAIClasses(classes: string[]): string[] {
  return classes.map((item) => item.trim()).filter((item) => item !== "" && isValidAIClassName(item));
}
