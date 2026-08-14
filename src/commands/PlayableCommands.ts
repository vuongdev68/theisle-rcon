import type {
  ExecuteOptions,
  PlayableEntry,
  PlayableUpdate,
  RconExecutor,
  RconResponse,
} from "../rcon/RconTypes.js";
import { evrimaProtocol } from "../rcon/EvrimaRconProtocol.js";
import { parsePlayablesResponse } from "../rcon/responseParsers.js";
import { requireCommandDefinition } from "./commandRegistry.js";

export class PlayableCommands {
  constructor(private readonly client: RconExecutor) {}

  async getPlayables(options?: ExecuteOptions): Promise<PlayableEntry[]> {
    const definition = requireCommandDefinition("getplayables");
    const response = await this.client.executeOpcode(definition.opcode, "", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: false,
    });
    return parsePlayablesResponse(response.body);
  }

  async updatePlayables(
    playables: string[] | PlayableUpdate[],
    options?: ExecuteOptions,
  ): Promise<RconResponse> {
    const definition = requireCommandDefinition("updateplayables");
    const args = formatPlayableUpdate(playables);
    return this.client.executeOpcode(definition.opcode, args, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }
}

export function formatPlayableUpdate(playables: string[] | PlayableUpdate[]): string {
  if (playables.length === 0) {
    return "";
  }
  if (typeof playables[0] === "string") {
    return evrimaProtocol.joinArguments(playables as string[]);
  }
  return (playables as PlayableUpdate[])
    .map((entry) => `${entry.className}:${entry.enabled ? "enabled" : "disabled"}`)
    .join(",");
}
