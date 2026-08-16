import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { ExecuteOptions } from "../rcon/RconTypes.js";

export class AdminService {
  constructor(private readonly client: EvrimaRconClient) {}

  async setGrowthMultiplier(value: number, options?: ExecuteOptions) {
    return this.client.setGrowthMultiplier(value, options);
  }

  async toggleGrowthMultiplier(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleGrowthMultiplier(enabled, options);
  }

  async toggleGlobalChat(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleGlobalChat(enabled, options);
  }

  async toggleHumans(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleHumans(enabled, options);
  }

  async toggleMigrations(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleMigrations(enabled, options);
  }

  async wipeCorpses(options?: ExecuteOptions) {
    return this.client.wipeCorpses(options);
  }

  async toggleAI(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleAI(enabled, options);
  }

  async setAIDensity(density: number, options?: ExecuteOptions) {
    return this.client.setAIDensity(density, options);
  }

  async disableAIClasses(classes: string[], options?: ExecuteOptions) {
    return this.client.disableAIClasses(classes, options);
  }

  async toggleAILearning(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleAILearning(enabled, options);
  }

  async toggleNetUpdateDistanceChecks(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleNetUpdateDistanceChecks(enabled, options);
  }
}
