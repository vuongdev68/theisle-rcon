/** Playable roster from The Isle Evrima Server Launcher (AllowedClasses). */
export const KnownPlayables = [
  "Dryosaurus",
  "Hypsilophodon",
  "Pachycephalosaurus",
  "Stegosaurus",
  "Tenontosaurus",
  "Carnotaurus",
  "Ceratosaurus",
  "Deinosuchus",
  "Diabloceratops",
  "Omniraptor",
  "Pteranodon",
  "Troodon",
  "Beipiaosaurus",
  "Gallimimus",
  "Dilophosaurus",
  "Herrerasaurus",
  "Maiasaura",
  "Triceratops",
  "Allosaurus",
  "Tyrannosaurus",
  "Kentrosaurus",
  "Austroraptor",
] as const;

export function mergePlayableCatalog(live: Array<{ name: string; enabled?: boolean }>): Array<{
  name: string;
  enabled: boolean;
}> {
  const byName = new Map<string, boolean>();
  const hasLiveFlags = live.some((item) => item.enabled === true || item.enabled === false);
  for (const item of KnownPlayables) {
    byName.set(item, live.length === 0);
  }
  if (live.length > 0 && !hasLiveFlags) {
    for (const key of byName.keys()) {
      byName.set(key, false);
    }
  }
  for (const item of live) {
    const name = item.name.trim();
    if (!name) {
      continue;
    }
    byName.set(name, item.enabled !== false);
  }
  return [...byName.entries()].map(([name, enabled]) => ({ name, enabled }));
}
