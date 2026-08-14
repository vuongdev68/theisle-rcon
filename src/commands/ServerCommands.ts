import type { ExecuteOptions, QueueStatus, RconExecutor, RconResponse, ServerDetails } from "../rcon/RconTypes.js";
import { parseQueueStatusResponse, parseServerDetailsResponse } from "../rcon/responseParsers.js";
import { requireCommandDefinition, toToggleArgument } from "./commandRegistry.js";

export class ServerCommands {
  constructor(private readonly client: RconExecutor) {}

  async getServerDetails(options?: ExecuteOptions): Promise<ServerDetails> {
    const definition = requireCommandDefinition("serverdetails");
    const response = await this.client.executeOpcode(definition.opcode, "", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: false,
    });
    return parseServerDetailsResponse(response.body);
  }

  async saveServer(backupName?: string, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("save");
    return this.client.executeOpcode(definition.opcode, backupName ?? "", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async pauseServer(options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("pause");
    return this.client.executeOpcode(definition.opcode, "1", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async unpauseServer(options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("pause");
    return this.client.executeOpcode(definition.opcode, "0", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async announce(message: string, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("announce");
    return this.client.executeOpcode(definition.opcode, message, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async getQueueStatus(options?: ExecuteOptions): Promise<QueueStatus> {
    const definition = requireCommandDefinition("getqueuestatus");
    const response = await this.client.executeOpcode(definition.opcode, "", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: false,
    });
    return parseQueueStatusResponse(response.body);
  }

  togglePauseArgument(enabled: boolean): string {
    return toToggleArgument(enabled);
  }
}
