import type { ExecuteOptions, RconExecutor, RconResponse } from "../rcon/RconTypes.js";
import { evrimaProtocol } from "../rcon/EvrimaRconProtocol.js";
import { requireCommandDefinition, toToggleArgument } from "./commandRegistry.js";

export class AICommands {
  constructor(private readonly client: RconExecutor) {}

  async toggleAI(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("toggleai");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async setAIDensity(density: number, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("aidensity");
    return this.client.executeOpcode(definition.opcode, density.toFixed(3), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async disableAIClasses(classes: string[], options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("disableaiclasses");
    const args = evrimaProtocol.joinArguments(classes);
    return this.client.executeOpcode(definition.opcode, args, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async toggleAILearning(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("toggleailearning");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }
}
