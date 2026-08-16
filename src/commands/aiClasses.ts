/**
 * Wildlife AI classes from the developer Game.ini comments
 * (Theislemanager/evrima-rcon). These are NPC spawns, not playable dinosaurs.
 */
export const KnownAIClasses = [
  { name: "Compsognathus", kind: "small carnivore" },
  { name: "Pterodactylus", kind: "flying" },
  { name: "Boar", kind: "prey" },
  { name: "Deer", kind: "prey" },
  { name: "Goat", kind: "prey" },
  { name: "Seaturtle", kind: "aquatic" },
] as const;

export type KnownAIClassName = (typeof KnownAIClasses)[number]["name"];

const knownNames = new Set<string>(KnownAIClasses.map((item) => item.name));

export function isKnownAIClass(name: string): name is KnownAIClassName {
  return knownNames.has(name);
}

export function filterKnownAIClasses(classes: string[]): string[] {
  return classes.map((item) => item.trim()).filter((item) => item !== "" && isKnownAIClass(item));
}
