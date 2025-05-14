/**
 * Types for Expo DevTools integration
 */

/**
 * Types of commands that can be executed in Expo
 */
export type ExpoCommandType =
  | 'reload'
  | 'toggle-inspector'
  | 'toggle-performance-monitor'
  | 'toggle-element-inspector'
  | 'clear-cache'
  | 'toggle-remote-debugging'
  | 'open-dev-menu'
  | 'take-screenshot'
  | 'shake-device';

/**
 * Status of a command execution
 */
export type ExpoCommandStatus = 'pending' | 'success' | 'error';

/**
 * Command object representing an Expo command
 */
export interface ExpoCommand {
  id: string;
  type: ExpoCommandType;
  status: ExpoCommandStatus;
  timestamp: number;
  deviceId: string;
  result?: any;
  error?: string;
}

/**
 * State of the Expo DevTools
 */
export interface ExpoDevToolsState {
  commands: Record<string, ExpoCommand[]>;
  isVisible: boolean;
  isLoading: boolean;
}

/**
 * Message for executing an Expo command
 */
export interface ExpoCommandActionMessage {
  action: 'ACTION-EXECUTE-EXPO-COMMAND';
  targetDeviceId: string;
  command: ExpoCommandType;
  commandId: string;
}

/**
 * Message for returning the result of an Expo command
 */
export interface ExpoCommandResultMessage {
  type: 'expo-command-result';
  command: ExpoCommand;
  persistentDeviceId: string;
}

/**
 * Message for requesting Expo DevTools status
 */
export interface ExpoDevToolsRequestMessage {
  type: 'request-expo-devtools-status';
  targetDeviceId: string;
}
