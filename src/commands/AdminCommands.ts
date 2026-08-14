import type { ExecuteOptions, RconExecutor, RconResponse } from "../rcon/RconTypes.js";
import { requireCommandDefinition, toToggleArgument } from "./commandRegistry.js";

export class AdminCommands {
  constructor(private readonly client: RconExecutor) {}

  async setGrowthMultiplier(value: number, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("setgrowthmultiplier");
    return this.client.executeOpcode(definition.opcode, String(value), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async toggleGrowthMultiplier(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("togglegrowthmultiplier");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async toggleGlobalChat(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("toggleglobalchat");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async toggleHumans(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("togglehumans");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async toggleMigrations(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("togglemigrations");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async wipeCorpses(options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("wipecorpses");
    return this.client.executeOpcode(definition.opcode, "", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async toggleNetUpdateDistanceChecks(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("togglenetupdatedistancechecks");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }
}
