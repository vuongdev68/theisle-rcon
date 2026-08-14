export const RconEvent = {
  Connected: "connected",
  Disconnected: "disconnected",
  Authenticated: "authenticated",
  AuthenticationFailed: "authenticationFailed",
  Error: "error",
  CommandSent: "commandSent",
  CommandResponse: "commandResponse",
  Timeout: "timeout",
  Reconnecting: "reconnecting",
  PlayerJoined: "playerJoined",
  PlayerLeft: "playerLeft",
  PlayerChanged: "playerChanged",
} as const;

export type RconEventName = (typeof RconEvent)[keyof typeof RconEvent];
