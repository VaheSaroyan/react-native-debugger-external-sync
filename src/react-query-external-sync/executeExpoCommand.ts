import { Socket } from "socket.io-client";
import { ExpoCommand, ExpoCommandType, ExpoCommandResultMessage } from "./expoDevToolsTypes";
import { log } from "./utils/logger";

/**
 * Execute an Expo command based on the command type
 * 
 * @param command The command to execute
 * @param socket The socket connection to send the result back
 * @param deviceId The device ID
 * @param enableLogs Whether to enable logs
 */
export const executeExpoCommand = async (
  command: ExpoCommand,
  socket: Socket,
  deviceId: string,
  enableLogs = false
): Promise<void> => {
  const logPrefix = `[ExpoCommand]`;
  log(`${logPrefix} Executing command: ${command.type}`, enableLogs);

  try {
    // Execute the command based on its type
    switch (command.type) {
      case 'reload':
        await executeReload();
        break;
      case 'toggle-inspector':
        await executeToggleInspector();
        break;
      case 'toggle-performance-monitor':
        await executeTogglePerformanceMonitor();
        break;
      case 'toggle-element-inspector':
        await executeToggleElementInspector();
        break;
      case 'clear-cache':
        await executeClearCache();
        break;
      case 'toggle-remote-debugging':
        await executeToggleRemoteDebugging();
        break;
      case 'open-dev-menu':
        await executeOpenDevMenu();
        break;
      case 'take-screenshot':
        await executeTakeScreenshot();
        break;
      case 'shake-device':
        await executeShakeDevice();
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }

    // Send success result back to the dashboard
    const resultMessage: ExpoCommandResultMessage = {
      type: 'expo-command-result',
      command: {
        ...command,
        status: 'success',
      },
      persistentDeviceId: deviceId,
    };

    socket.emit('expo-command-result', resultMessage);
    log(`${logPrefix} Command executed successfully: ${command.type}`, enableLogs);
  } catch (error) {
    // Send error result back to the dashboard
    const resultMessage: ExpoCommandResultMessage = {
      type: 'expo-command-result',
      command: {
        ...command,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
      persistentDeviceId: deviceId,
    };

    socket.emit('expo-command-result', resultMessage);
    log(`${logPrefix} Command execution failed: ${command.type}`, enableLogs, 'error');
    log(`${logPrefix} Error: ${error}`, enableLogs, 'error');
  }
};

/**
 * Execute the reload command
 * Default implementation attempts to use Expo's reload function if available
 */
export let executeReload = async (): Promise<void> => {
  try {
    // Try to use Expo's reload function if available
    if (typeof global !== 'undefined' && global.__expo && global.__expo.reload) {
      global.__expo.reload();
      return;
    }
    
    // Try to use React Native's DevSettings if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const DevSettings = global.require('react-native').DevSettings;
        if (DevSettings && DevSettings.reload) {
          DevSettings.reload();
          return;
        }
      } catch (e) {
        // DevSettings not available, continue to next method
      }
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { DevMenu } = global.require('react-native').NativeModules;
        if (DevMenu && DevMenu.reload) {
          DevMenu.reload();
          return;
        }
      } catch (e) {
        // DevMenu not available
      }
    }
    
    console.log('Reload command received but no implementation found. Override with setReloadImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing reload command:', error);
  }
};

/**
 * Execute the toggle inspector command
 * Default implementation attempts to use React Native's DevSettings if available
 */
export let executeToggleInspector = async (): Promise<void> => {
  try {
    // Try to use React Native's DevSettings if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const DevSettings = global.require('react-native').DevSettings;
        if (DevSettings && DevSettings.toggleElementInspector) {
          DevSettings.toggleElementInspector();
          return;
        }
      } catch (e) {
        // DevSettings not available, continue to next method
      }
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { DevMenu } = global.require('react-native').NativeModules;
        if (DevMenu && DevMenu.toggleElementInspector) {
          DevMenu.toggleElementInspector();
          return;
        }
      } catch (e) {
        // DevMenu not available
      }
    }
    
    console.log('Toggle inspector command received but no implementation found. Override with setToggleInspectorImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing toggle inspector command:', error);
  }
};

/**
 * Execute the toggle performance monitor command
 * Default implementation attempts to use React Native's DevSettings if available
 */
export let executeTogglePerformanceMonitor = async (): Promise<void> => {
  try {
    // Try to use React Native's DevSettings if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const DevSettings = global.require('react-native').DevSettings;
        if (DevSettings && DevSettings.togglePerformanceMonitor) {
          DevSettings.togglePerformanceMonitor();
          return;
        }
      } catch (e) {
        // DevSettings not available, continue to next method
      }
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { DevMenu } = global.require('react-native').NativeModules;
        if (DevMenu && DevMenu.togglePerformanceMonitor) {
          DevMenu.togglePerformanceMonitor();
          return;
        }
      } catch (e) {
        // DevMenu not available
      }
    }
    
    console.log('Toggle performance monitor command received but no implementation found. Override with setTogglePerformanceMonitorImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing toggle performance monitor command:', error);
  }
};

/**
 * Execute the toggle element inspector command
 * Default implementation attempts to use React Native's DevSettings if available
 */
export let executeToggleElementInspector = async (): Promise<void> => {
  try {
    // Try to use React Native's DevSettings if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const DevSettings = global.require('react-native').DevSettings;
        if (DevSettings && DevSettings.toggleElementInspector) {
          DevSettings.toggleElementInspector();
          return;
        }
      } catch (e) {
        // DevSettings not available, continue to next method
      }
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { DevMenu } = global.require('react-native').NativeModules;
        if (DevMenu && DevMenu.toggleElementInspector) {
          DevMenu.toggleElementInspector();
          return;
        }
      } catch (e) {
        // DevMenu not available
      }
    }
    
    console.log('Toggle element inspector command received but no implementation found. Override with setToggleElementInspectorImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing toggle element inspector command:', error);
  }
};

/**
 * Execute the clear cache command
 * Default implementation attempts to clear AsyncStorage if available
 */
export let executeClearCache = async (): Promise<void> => {
  try {
    // Try to use AsyncStorage if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const AsyncStorage = global.require('@react-native-async-storage/async-storage').default;
        if (AsyncStorage && AsyncStorage.clear) {
          await AsyncStorage.clear();
          console.log('AsyncStorage cache cleared');
          return;
        }
      } catch (e) {
        // AsyncStorage not available, continue to next method
      }
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { ImageLoader } = global.require('react-native').NativeModules;
        if (ImageLoader && ImageLoader.clearCache) {
          await ImageLoader.clearCache();
          console.log('Image cache cleared');
          return;
        }
      } catch (e) {
        // ImageLoader not available
      }
    }
    
    console.log('Clear cache command received but no implementation found. Override with setClearCacheImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing clear cache command:', error);
  }
};

/**
 * Execute the toggle remote debugging command
 * Default implementation attempts to use React Native's DevSettings if available
 */
export let executeToggleRemoteDebugging = async (): Promise<void> => {
  try {
    // Try to use React Native's DevSettings if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const DevSettings = global.require('react-native').DevSettings;
        if (DevSettings && DevSettings.setIsDebuggingRemotely) {
          // Toggle the current state
          const currentState = typeof global.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
          DevSettings.setIsDebuggingRemotely(!currentState);
          return;
        }
      } catch (e) {
        // DevSettings not available, continue to next method
      }
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { DevMenu } = global.require('react-native').NativeModules;
        if (DevMenu && DevMenu.toggleRemoteDebugging) {
          DevMenu.toggleRemoteDebugging();
          return;
        }
      } catch (e) {
        // DevMenu not available
      }
    }
    
    console.log('Toggle remote debugging command received but no implementation found. Override with setToggleRemoteDebuggingImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing toggle remote debugging command:', error);
  }
};

/**
 * Execute the open dev menu command
 * Default implementation attempts to use React Native's DevSettings if available
 */
export let executeOpenDevMenu = async (): Promise<void> => {
  try {
    // Try to use Expo's DevMenu if available
    if (typeof global !== 'undefined' && global.__expo && global.__expo.openDevMenu) {
      global.__expo.openDevMenu();
      return;
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { DevMenu } = global.require('react-native').NativeModules;
        if (DevMenu && DevMenu.show) {
          DevMenu.show();
          return;
        }
      } catch (e) {
        // DevMenu not available
      }
    }
    
    console.log('Open dev menu command received but no implementation found. Override with setOpenDevMenuImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing open dev menu command:', error);
  }
};

/**
 * Execute the take screenshot command
 * Default implementation attempts to use React Native's NativeModules if available
 */
export let executeTakeScreenshot = async (): Promise<void> => {
  try {
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { RNScreenshot } = global.require('react-native').NativeModules;
        if (RNScreenshot && RNScreenshot.takeScreenshot) {
          await RNScreenshot.takeScreenshot();
          return;
        }
      } catch (e) {
        // RNScreenshot not available
      }
    }
    
    console.log('Take screenshot command received but no implementation found. Override with setTakeScreenshotImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing take screenshot command:', error);
  }
};

/**
 * Execute the shake device command
 * Default implementation attempts to use React Native's NativeModules if available
 */
export let executeShakeDevice = async (): Promise<void> => {
  try {
    // Try to use React Native's DevSettings if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const DevSettings = global.require('react-native').DevSettings;
        if (DevSettings && DevSettings.reload) {
          // There's no direct shake method, but we can show the dev menu which is similar
          if (DevSettings.show) {
            DevSettings.show();
            return;
          }
        }
      } catch (e) {
        // DevSettings not available, continue to next method
      }
    }
    
    // Try to use React Native's NativeModules if available
    if (typeof global !== 'undefined' && global.require) {
      try {
        const { DevMenu } = global.require('react-native').NativeModules;
        if (DevMenu && DevMenu.show) {
          DevMenu.show();
          return;
        }
      } catch (e) {
        // DevMenu not available
      }
    }
    
    console.log('Shake device command received but no implementation found. Override with setShakeDeviceImplementation() for custom behavior.');
  } catch (error) {
    console.warn('Error executing shake device command:', error);
  }
};

/**
 * Set the implementation for the reload command
 * @param implementation The implementation function
 */
export const setReloadImplementation = (implementation: () => Promise<void>): void => {
  executeReload = implementation;
};

/**
 * Set the implementation for the toggle inspector command
 * @param implementation The implementation function
 */
export const setToggleInspectorImplementation = (implementation: () => Promise<void>): void => {
  executeToggleInspector = implementation;
};

/**
 * Set the implementation for the toggle performance monitor command
 * @param implementation The implementation function
 */
export const setTogglePerformanceMonitorImplementation = (implementation: () => Promise<void>): void => {
  executeTogglePerformanceMonitor = implementation;
};

/**
 * Set the implementation for the toggle element inspector command
 * @param implementation The implementation function
 */
export const setToggleElementInspectorImplementation = (implementation: () => Promise<void>): void => {
  executeToggleElementInspector = implementation;
};

/**
 * Set the implementation for the clear cache command
 * @param implementation The implementation function
 */
export const setClearCacheImplementation = (implementation: () => Promise<void>): void => {
  executeClearCache = implementation;
};

/**
 * Set the implementation for the toggle remote debugging command
 * @param implementation The implementation function
 */
export const setToggleRemoteDebuggingImplementation = (implementation: () => Promise<void>): void => {
  executeToggleRemoteDebugging = implementation;
};

/**
 * Set the implementation for the open dev menu command
 * @param implementation The implementation function
 */
export const setOpenDevMenuImplementation = (implementation: () => Promise<void>): void => {
  executeOpenDevMenu = implementation;
};

/**
 * Set the implementation for the take screenshot command
 * @param implementation The implementation function
 */
export const setTakeScreenshotImplementation = (implementation: () => Promise<void>): void => {
  executeTakeScreenshot = implementation;
};

/**
 * Set the implementation for the shake device command
 * @param implementation The implementation function
 */
export const setShakeDeviceImplementation = (implementation: () => Promise<void>): void => {
  executeShakeDevice = implementation;
};

/**
 * Set implementations for all Expo commands at once
 * @param implementations Object containing implementations for each command
 */
export const setExpoCommandImplementations = (implementations: {
  reload?: () => Promise<void>;
  toggleInspector?: () => Promise<void>;
  togglePerformanceMonitor?: () => Promise<void>;
  toggleElementInspector?: () => Promise<void>;
  clearCache?: () => Promise<void>;
  toggleRemoteDebugging?: () => Promise<void>;
  openDevMenu?: () => Promise<void>;
  takeScreenshot?: () => Promise<void>;
  shakeDevice?: () => Promise<void>;
}): void => {
  if (implementations.reload) {
    executeReload = implementations.reload;
  }
  if (implementations.toggleInspector) {
    executeToggleInspector = implementations.toggleInspector;
  }
  if (implementations.togglePerformanceMonitor) {
    executeTogglePerformanceMonitor = implementations.togglePerformanceMonitor;
  }
  if (implementations.toggleElementInspector) {
    executeToggleElementInspector = implementations.toggleElementInspector;
  }
  if (implementations.clearCache) {
    executeClearCache = implementations.clearCache;
  }
  if (implementations.toggleRemoteDebugging) {
    executeToggleRemoteDebugging = implementations.toggleRemoteDebugging;
  }
  if (implementations.openDevMenu) {
    executeOpenDevMenu = implementations.openDevMenu;
  }
  if (implementations.takeScreenshot) {
    executeTakeScreenshot = implementations.takeScreenshot;
  }
  if (implementations.shakeDevice) {
    executeShakeDevice = implementations.shakeDevice;
  }
};
