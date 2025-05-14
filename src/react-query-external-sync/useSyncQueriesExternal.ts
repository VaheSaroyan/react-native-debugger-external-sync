import { useEffect, useRef } from "react";
import type { QueryKey } from "@tanstack/query-core";
import { onlineManager, QueryClient } from "@tanstack/react-query";

import { log } from "./utils/logger";
import { Dehydrate } from "./hydration";
import { PlatformOS } from "./platformUtils";
import {
  setupFetchInterceptor,
  setupXHRInterceptor,
  setupWebSocketInterceptor
} from "./sendNetworkRequest";
import {
  AsyncStorageActionMessage,
  AsyncStorageRequestMessage,
  SyncMessage,
  AsyncStorageSyncMessage,
  AsyncStorageState,
  NetworkRequest,
  NetworkRequestSyncMessage,
  NetworkMonitoringActionMessage,
  NetworkRequestMessage
} from "./types";
import {
  ExpoCommandActionMessage,
  ExpoCommandResultMessage,
  ExpoCommand,
  ExpoDevToolsRequestMessage
} from "./expoDevToolsTypes";
import { executeExpoCommand } from "./executeExpoCommand";
import { useMySocket } from "./useMySocket";

/**
 * Query actions that can be performed on a query.
 * These actions are used to synchronize query state between devices and the dashboard.
 */
type QueryActions =
  // Regular query actions
  | "ACTION-REFETCH" // Refetch a query without invalidating it
  | "ACTION-INVALIDATE" // Invalidate a query and trigger a refetch
  | "ACTION-RESET" // Reset a query to its initial state
  | "ACTION-REMOVE" // Remove a query from the cache
  | "ACTION-DATA-UPDATE" // Update a query's data manually
  // Error handling actions
  | "ACTION-TRIGGER-ERROR" // Manually trigger an error state
  | "ACTION-RESTORE-ERROR" // Restore from an error state
  // Loading state actions
  | "ACTION-TRIGGER-LOADING" // Manually trigger a loading state
  | "ACTION-RESTORE-LOADING" // Restore from a loading state
  // Online status actions
  | "ACTION-ONLINE-MANAGER-ONLINE" // Set online manager to online
  | "ACTION-ONLINE-MANAGER-OFFLINE" // Set online manager to offline
  // Internal action
  | "success" // Internal success action
  | "ACTION-CLEAR-MUTATION-CACHE" // Clear the mutation cache
  | "ACTION-CLEAR-QUERY-CACHE"; // Clear the query cache

/**
 * Message structure for query actions between dashboard and devices
 */
interface QueryActionMessage {
  queryHash: string; // Unique hash of the query
  queryKey: QueryKey; // Key array used to identify the query
  data: unknown; // Data payload (if applicable)
  action: QueryActions; // Action to perform
  targetDeviceId: string; // Device to target
}

/**
 * Message structure for online manager actions from dashboard to devices
 */
interface OnlineManagerMessage {
  action: "ACTION-ONLINE-MANAGER-ONLINE" | "ACTION-ONLINE-MANAGER-OFFLINE";
  targetDeviceId: string; // Device ID to target ('All' || device)
}

/**
 * Determines if a message should be processed by the current device
 */
interface ShouldProcessMessageProps {
  targetDeviceId: string;
  currentDeviceId: string;
}
function shouldProcessMessage({
  targetDeviceId,
  currentDeviceId,
}: ShouldProcessMessageProps): boolean {
  return targetDeviceId === currentDeviceId || targetDeviceId === "All";
}

/**
 * Verifies if the React Query version is compatible with dev tools
 */
function checkVersion(queryClient: QueryClient) {
  // Basic version check
  const version = (
    queryClient as unknown as {
      getDefaultOptions?: () => { queries?: { version?: unknown } };
    }
  ).getDefaultOptions?.()?.queries?.version;
  if (
    version &&
    !version.toString().startsWith("4") &&
    !version.toString().startsWith("5")
  ) {
    log(
      "This version of React Query has not been tested with the dev tools plugin. Some features might not work as expected.",
      true,
      "warn"
    );
  }
}

/**
 * Network monitoring options
 */
export interface NetworkMonitoringOptions {
  /**
   * Enable fetch API monitoring
   * @default false
   */
  fetch?: boolean;

  /**
   * Enable XMLHttpRequest monitoring
   * @default false
   */
  xhr?: boolean;

  /**
   * Enable WebSocket monitoring
   * @default false
   */
  websocket?: boolean;
}

/**
 * Expo DevTools options
 */
export interface ExpoDevToolsOptions {
  /**
   * Enable Expo DevTools integration
   * @default false
   */
  enabled?: boolean;
}

interface useSyncQueriesExternalProps {
  queryClient: QueryClient;
  deviceName: string;
  /**
   * A unique identifier for this device that persists across app restarts.
   * This is crucial for proper device tracking, especially if you have multiple devices of the same type.
   * If you only have one iOS and one Android device, you can use 'ios' and 'android'.
   * For multiple devices of the same type, ensure this ID is unique and persistent.
   */
  deviceId: string;
  extraDeviceInfo?: Record<string, string>; // Additional device information as key-value pairs
  socketURL: string;
  platform: PlatformOS; // Required platform
  /**
   * Enable/disable logging for debugging purposes
   * @default false
   */
  enableLogs?: boolean;
  /**
   * Optional AsyncStorage implementation for AsyncStorage viewer integration
   * This should be the AsyncStorage instance from @react-native-async-storage/async-storage
   */
  asyncStorage?: {
    getAllKeys: () => Promise<readonly string[]>;
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  /**
   * Network monitoring options
   * Configure which network request types to monitor
   * @default undefined (no monitoring)
   */
  networkMonitoring?: NetworkMonitoringOptions;
  /**
   * Expo DevTools options
   * Configure Expo DevTools integration
   * @default undefined (no Expo DevTools integration)
   */
  expoDevTools?: ExpoDevToolsOptions;
}

/**
 * Hook used by mobile devices to sync query state with the external dashboard
 *
 * Handles:
 * - Connection to the socket server
 * - Responding to dashboard requests
 * - Processing query actions from the dashboard
 * - Sending query state updates to the dashboard
 */
export function useSyncQueriesExternal({
  queryClient,
  deviceName,
  socketURL,
  extraDeviceInfo,
  platform,
  deviceId,
  enableLogs = false,
  asyncStorage,
  networkMonitoring,
}: useSyncQueriesExternalProps) {
  // ==========================================================
  // Validate deviceId
  // ==========================================================
  if (!deviceId?.trim()) {
    throw new Error(
      `[${deviceName}] deviceId is required and must not be empty. This ID must persist across app restarts, especially if you have multiple devices of the same type. If you only have one iOS and one Android device, you can use 'ios' and 'android'.`
    );
  }

  // ==========================================================
  // Persistent device ID - used to identify this device
  // across app restarts
  // ==========================================================
  const logPrefix = `[${deviceName}]`;
  // ==========================================================
  // Socket connection - Handles connection to the socket server and
  // event listeners for the socket server
  // ==========================================================
  const { connect, disconnect, isConnected, socket } = useMySocket({
    deviceName,
    socketURL,
    persistentDeviceId: deviceId,
    extraDeviceInfo,
    platform,
    enableLogs,
  });

  // Use refs to track state and cleanup functions
  const prevConnectedRef = useRef(false);
  const removeFetchInterceptorRef = useRef<(() => void) | null>(null);
  const removeXHRInterceptorRef = useRef<(() => void) | null>(null);
  const removeWebSocketInterceptorRef = useRef<(() => void) | null>(null);

  // Helper function to send AsyncStorage state to the dashboard
  const sendAsyncStorageState = async () => {
    if (!asyncStorage || !socket || !deviceId) {
      return;
    }

    try {
      const keys = await asyncStorage.getAllKeys();
      const items = [];

      for (const key of keys) {
        const value = await asyncStorage.getItem(key);
        items.push({ key, value: value || '' });
      }

      const syncMessage: AsyncStorageSyncMessage = {
        type: "async-storage-state",
        state: {
          items,
          timestamp: Date.now()
        },
        persistentDeviceId: deviceId
      };

      socket.emit('async-storage-sync', syncMessage);
      log(`${logPrefix} Sent AsyncStorage state to dashboard (${items.length} items)`, enableLogs);
    } catch (error) {
      log(`${logPrefix} Error sending AsyncStorage state: ${error}`, enableLogs, "error");
    }
  };

  useEffect(() => {
    checkVersion(queryClient);

    // Only log connection state changes to reduce noise
    if (prevConnectedRef.current !== isConnected) {
      if (!isConnected) {
        log(`${logPrefix} Not connected to external dashboard`, enableLogs);
      } else {
        log(`${deviceName} Connected to external dashboard`, enableLogs);
      }
      prevConnectedRef.current = isConnected;
    }

    // Don't proceed with setting up event handlers if not connected
    if (!isConnected || !socket) {
      return;
    }

    // ==========================================================
    // Event Handlers
    // ==========================================================

    // ==========================================================
    // Handle initial state requests from dashboard
    // ==========================================================
    const initialStateSubscription = socket.on("request-initial-state", () => {
      if (!deviceId) {
        log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
        return;
      }
      log(`${logPrefix} Dashboard is requesting initial state`, enableLogs);
      const dehydratedState = Dehydrate(queryClient as unknown as QueryClient);
      const syncMessage: SyncMessage = {
        type: "dehydrated-state",
        state: dehydratedState,
        isOnlineManagerOnline: onlineManager.isOnline(),
        persistentDeviceId: deviceId,
      };
      socket.emit("query-sync", syncMessage);
      log(
        `[${deviceName}] Sent initial state to dashboard (${dehydratedState.queries.length} queries)`,
        enableLogs
      );
    });

    // ==========================================================
    // Online manager handler - Handle device internet connection state changes
    // ==========================================================
    const onlineManagerSubscription = socket.on(
      "online-manager",
      (message: OnlineManagerMessage) => {
        const { action, targetDeviceId } = message;
        if (!deviceId) {
          log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
          return;
        }
        // Only process if this message targets the current device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(
          `[${deviceName}] Received online-manager action: ${action}`,
          enableLogs
        );

        switch (action) {
          case "ACTION-ONLINE-MANAGER-ONLINE": {
            log(`${logPrefix} Set online state: ONLINE`, enableLogs);
            onlineManager.setOnline(true);
            break;
          }
          case "ACTION-ONLINE-MANAGER-OFFLINE": {
            log(`${logPrefix} Set online state: OFFLINE`, enableLogs);
            onlineManager.setOnline(false);
            break;
          }
        }
      }
    );

    // ==========================================================
    // Query Actions handler - Process actions from the dashboard
    // ==========================================================
    const queryActionSubscription = socket.on(
      "query-action",
      (message: QueryActionMessage) => {
        const { queryHash, queryKey, data, action, targetDeviceId } = message;
        if (!deviceId) {
          log(
            `[${deviceName}] No persistent device ID found`,
            enableLogs,
            "warn"
          );
          return;
        }
        // Skip if not targeted at this device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(
          `${logPrefix} Received query action: ${action} for query ${queryHash}`,
          enableLogs
        );
        // If action is clear cache do the action here before moving on
        if (action === "ACTION-CLEAR-MUTATION-CACHE") {
          queryClient.getMutationCache().clear();
          log(`${logPrefix} Cleared mutation cache`, enableLogs);
          return;
        }
        if (action === "ACTION-CLEAR-QUERY-CACHE") {
          queryClient.getQueryCache().clear();
          log(`${logPrefix} Cleared query cache`, enableLogs);
          return;
        }

        const activeQuery = queryClient.getQueryCache().get(queryHash);
        if (!activeQuery) {
          log(
            `${logPrefix} Query with hash ${queryHash} not found`,
            enableLogs,
            "warn"
          );
          return;
        }

        switch (action) {
          case "ACTION-DATA-UPDATE": {
            log(`${logPrefix} Updating data for query:`, enableLogs);
            queryClient.setQueryData(queryKey, data, {
              updatedAt: Date.now(),
            });
            break;
          }

          case "ACTION-TRIGGER-ERROR": {
            log(`${logPrefix} Triggering error state for query:`, enableLogs);
            const error = new Error("Unknown error from devtools");

            const __previousQueryOptions = activeQuery.options;
            activeQuery.setState({
              status: "error",
              error,
              fetchMeta: {
                ...activeQuery.state.fetchMeta,
                // @ts-expect-error This does exist
                __previousQueryOptions,
              },
            });
            break;
          }
          case "ACTION-RESTORE-ERROR": {
            log(
              `${logPrefix} Restoring from error state for query:`,
              enableLogs
            );
            queryClient.resetQueries(activeQuery);
            break;
          }
          case "ACTION-TRIGGER-LOADING": {
            if (!activeQuery) return;
            log(`${logPrefix} Triggering loading state for query:`, enableLogs);
            const __previousQueryOptions = activeQuery.options;
            // Trigger a fetch in order to trigger suspense as well.
            activeQuery.fetch({
              ...__previousQueryOptions,
              queryFn: () => {
                return new Promise(() => {
                  // Never resolve - simulates perpetual loading
                });
              },
              gcTime: -1,
            });
            activeQuery.setState({
              data: undefined,
              status: "pending",
              fetchMeta: {
                ...activeQuery.state.fetchMeta,
                // @ts-expect-error This does exist
                __previousQueryOptions,
              },
            });
            break;
          }
          case "ACTION-RESTORE-LOADING": {
            log(
              `${logPrefix} Restoring from loading state for query:`,
              enableLogs
            );
            const previousState = activeQuery.state;
            const previousOptions = activeQuery.state.fetchMeta
              ? (
                  activeQuery.state.fetchMeta as unknown as {
                    __previousQueryOptions: unknown;
                  }
                ).__previousQueryOptions
              : null;

            activeQuery.cancel({ silent: true });
            activeQuery.setState({
              ...previousState,
              fetchStatus: "idle",
              fetchMeta: null,
            });

            if (previousOptions) {
              activeQuery.fetch(previousOptions);
            }
            break;
          }
          case "ACTION-RESET": {
            log(`${logPrefix} Resetting query:`, enableLogs);
            queryClient.resetQueries(activeQuery);
            break;
          }
          case "ACTION-REMOVE": {
            log(`${logPrefix} Removing query:`, enableLogs);
            queryClient.removeQueries(activeQuery);
            break;
          }
          case "ACTION-REFETCH": {
            log(`${logPrefix} Refetching query:`, enableLogs);
            const promise = activeQuery.fetch();
            promise.catch((error) => {
              // Log fetch errors but don't propagate them
              log(
                `[${deviceName}] Refetch error for ${queryHash}:`,
                enableLogs,
                "error"
              );
            });
            break;
          }
          case "ACTION-INVALIDATE": {
            log(`${logPrefix} Invalidating query:`, enableLogs);
            queryClient.invalidateQueries(activeQuery);
            break;
          }
          case "ACTION-ONLINE-MANAGER-ONLINE": {
            log(`${logPrefix} Setting online state: ONLINE`, enableLogs);
            onlineManager.setOnline(true);
            break;
          }
          case "ACTION-ONLINE-MANAGER-OFFLINE": {
            log(`${logPrefix} Setting online state: OFFLINE`, enableLogs);
            onlineManager.setOnline(false);
            break;
          }
        }
      }
    );

    // ==========================================================
    // Subscribe to query changes and sync to dashboard
    // ==========================================================
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (!deviceId) {
        log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
        return;
      }
      // Dehydrate the current state
      const dehydratedState = Dehydrate(queryClient as unknown as QueryClient);

      // Create sync message
      const syncMessage: SyncMessage = {
        type: "dehydrated-state",
        state: dehydratedState,
        isOnlineManagerOnline: onlineManager.isOnline(),
        persistentDeviceId: deviceId,
      };

      // Send message to dashboard
      socket.emit("query-sync", syncMessage);
    });

    // ==========================================================
    // AsyncStorage handlers - Process AsyncStorage actions from the dashboard
    // ==========================================================
    const asyncStorageActionSubscription = socket.on(
      "async-storage-action",
      async (message: AsyncStorageActionMessage) => {
        const { action, targetDeviceId, key, value } = message;

        if (!deviceId) {
          log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
          return;
        }

        // Skip if not targeted at this device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(
          `${logPrefix} Received AsyncStorage action: ${action}${key ? ` for key ${key}` : ''}`,
          enableLogs
        );

        // If AsyncStorage is provided, handle the action directly
        if (asyncStorage) {
          try {
            switch (action) {
              case 'GET_ALL_KEYS':
                await sendAsyncStorageState();
                break;

              case 'GET_ITEM':
                if (key) {
                  const value = await asyncStorage.getItem(key);
                  log(`${logPrefix} Got AsyncStorage item: ${key} = ${value}`, enableLogs);
                  // After getting the item, send the full state back
                  await sendAsyncStorageState();
                }
                break;

              case 'SET_ITEM':
                if (key && value !== undefined) {
                  await asyncStorage.setItem(key, value);
                  log(`${logPrefix} Set AsyncStorage item: ${key} = ${value}`, enableLogs);
                  // After setting the item, send the updated state back
                  await sendAsyncStorageState();
                }
                break;

              case 'REMOVE_ITEM':
                if (key) {
                  await asyncStorage.removeItem(key);
                  log(`${logPrefix} Removed AsyncStorage item: ${key}`, enableLogs);
                  // After removing the item, send the updated state back
                  await sendAsyncStorageState();
                }
                break;

              case 'CLEAR_ALL':
                await asyncStorage.clear();
                log(`${logPrefix} Cleared all AsyncStorage items`, enableLogs);
                // After clearing all items, send the updated state back
                await sendAsyncStorageState();
                break;
            }
          } catch (error) {
            log(`${logPrefix} Error handling AsyncStorage action: ${error}`, enableLogs, "error");
          }
        } else {
          // If AsyncStorage is not provided, emit the event for the app to handle
          socket.emit("async-storage-action-received", message);

          log(`${logPrefix} Emitted async-storage-action-received event for app to handle`, enableLogs);
        }
      }
    );

    // ==========================================================
    // Handle AsyncStorage state requests from dashboard
    // ==========================================================
    const asyncStorageRequestSubscription = socket.on(
      "request-async-storage",
      async (message: AsyncStorageRequestMessage) => {
        const { targetDeviceId } = message;

        if (!deviceId) {
          log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
          return;
        }

        // Skip if not targeted at this device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(`${logPrefix} Dashboard is requesting AsyncStorage state`, enableLogs);

        // If AsyncStorage is provided, handle the request directly
        if (asyncStorage) {
          await sendAsyncStorageState();
        } else {
          // If AsyncStorage is not provided, emit the event for the app to handle
          socket.emit("request-async-storage-received", { type: "request-async-storage" });

          log(`${logPrefix} Emitted request-async-storage-received event for app to handle`, enableLogs);
        }
      }
    );

    // ==========================================================
    // Network Monitoring - Set up interceptors if enabled
    // ==========================================================
    if (networkMonitoring) {
      // Set up fetch interceptor if enabled
      if (networkMonitoring.fetch) {
        log(`${logPrefix} Setting up fetch interceptor`, enableLogs);
        removeFetchInterceptorRef.current = setupFetchInterceptor(socket, deviceId, enableLogs);
      }

      // Set up XHR interceptor if enabled
      if (networkMonitoring.xhr) {
        log(`${logPrefix} Setting up XHR interceptor`, enableLogs);
        removeXHRInterceptorRef.current = setupXHRInterceptor(socket, deviceId, enableLogs);
      }

      // Set up WebSocket interceptor if enabled
      if (networkMonitoring.websocket) {
        log(`${logPrefix} Setting up WebSocket interceptor`, enableLogs);
        removeWebSocketInterceptorRef.current = setupWebSocketInterceptor(socket, deviceId, enableLogs);
      }
    }

    // ==========================================================
    // Network Monitoring - Handle network monitoring actions
    // ==========================================================
    const networkMonitoringSubscription = socket.on(
      "network-monitoring-action",
      (message: NetworkMonitoringActionMessage) => {
        const { action, targetDeviceId } = message;
        if (!deviceId) {
          log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
          return;
        }

        // Only process if this message targets the current device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(
          `${logPrefix} Received network-monitoring action: ${action}`,
          enableLogs
        );

        switch (action) {
          case "ACTION-ENABLE-NETWORK-MONITORING": {
            log(`${logPrefix} Enabling network monitoring`, enableLogs);

            // Set up fetch interceptor if not already set up
            if (!removeFetchInterceptorRef.current) {
              removeFetchInterceptorRef.current = setupFetchInterceptor(socket, deviceId, enableLogs);
            }

            // Set up XHR interceptor if not already set up
            if (!removeXHRInterceptorRef.current) {
              removeXHRInterceptorRef.current = setupXHRInterceptor(socket, deviceId, enableLogs);
            }

            // Set up WebSocket interceptor if not already set up
            if (!removeWebSocketInterceptorRef.current) {
              removeWebSocketInterceptorRef.current = setupWebSocketInterceptor(socket, deviceId, enableLogs);
            }
            break;
          }
          case "ACTION-DISABLE-NETWORK-MONITORING": {
            log(`${logPrefix} Disabling network monitoring`, enableLogs);

            // Clean up fetch interceptor
            if (removeFetchInterceptorRef.current) {
              removeFetchInterceptorRef.current();
              removeFetchInterceptorRef.current = null;
            }

            // Clean up XHR interceptor
            if (removeXHRInterceptorRef.current) {
              removeXHRInterceptorRef.current();
              removeXHRInterceptorRef.current = null;
            }

            // Clean up WebSocket interceptor
            if (removeWebSocketInterceptorRef.current) {
              removeWebSocketInterceptorRef.current();
              removeWebSocketInterceptorRef.current = null;
            }
            break;
          }
        }
      }
    );

    // ==========================================================
    // Handle network monitoring requests from dashboard
    // ==========================================================
    const networkRequestSubscription = socket.on(
      "request-network-monitoring",
      (message: NetworkRequestMessage) => {
        const { targetDeviceId } = message;
        if (!deviceId) {
          log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
          return;
        }

        // Only process if this message targets the current device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(
          `${logPrefix} Dashboard is requesting network monitoring state`,
          enableLogs
        );

        // Your app should implement this functionality to send current network requests
        // For example: sendCurrentNetworkRequests();
      }
    );

    // ==========================================================
    // Handle Expo command actions from the dashboard
    // ==========================================================
    const expoCommandActionSubscription = socket.on(
      "expo-command-action",
      async (message: ExpoCommandActionMessage) => {
        const { command, targetDeviceId, commandId } = message;
        if (!deviceId) {
          log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
          return;
        }

        // Only process if this message targets the current device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(
          `${logPrefix} Received Expo command action: ${command} (ID: ${commandId})`,
          enableLogs
        );

        // Create a command object
        const expoCommand: ExpoCommand = {
          id: commandId,
          type: command,
          status: 'pending',
          timestamp: Date.now(),
          deviceId: targetDeviceId,
        };

        // Execute the command
        await executeExpoCommand(expoCommand, socket, deviceId, enableLogs);
      }
    );

    // ==========================================================
    // Handle Expo DevTools status requests from dashboard
    // ==========================================================
    const expoDevToolsRequestSubscription = socket.on(
      "request-expo-devtools-status",
      (message: ExpoDevToolsRequestMessage) => {
        const { targetDeviceId } = message;
        if (!deviceId) {
          log(`${logPrefix} No persistent device ID found`, enableLogs, "warn");
          return;
        }

        // Only process if this message targets the current device
        if (
          !shouldProcessMessage({
            targetDeviceId: targetDeviceId,
            currentDeviceId: deviceId,
          })
        ) {
          return;
        }

        log(
          `${logPrefix} Dashboard is requesting Expo DevTools status`,
          enableLogs
        );

        // Send a success response to indicate that Expo DevTools is available
        const resultMessage: ExpoCommandResultMessage = {
          type: 'expo-command-result',
          command: {
            id: 'status-check',
            type: 'reload', // Doesn't matter for status check
            status: 'success',
            timestamp: Date.now(),
            deviceId: targetDeviceId,
            result: { expoDevToolsAvailable: true },
          },
          persistentDeviceId: deviceId,
        };

        socket.emit('expo-command-result', resultMessage);
      }
    );

  // ==========================================================
  // Cleanup function to unsubscribe from all events
  // ==========================================================
  return () => {
    log(`${logPrefix} Cleaning up event listeners`, enableLogs);
    queryActionSubscription?.off();
    initialStateSubscription?.off();
    onlineManagerSubscription?.off();
    asyncStorageActionSubscription?.off();
    asyncStorageRequestSubscription?.off();

    if (networkMonitoringSubscription) {
      networkMonitoringSubscription.off();
    }

    if (networkRequestSubscription) {
      networkRequestSubscription.off();
    }

    if (expoCommandActionSubscription) {
      expoCommandActionSubscription.off();
    }

    if (expoDevToolsRequestSubscription) {
      expoDevToolsRequestSubscription.off();
    }

    // Clean up network interceptors
    if (removeFetchInterceptorRef.current) {
      removeFetchInterceptorRef.current();
      removeFetchInterceptorRef.current = null;
    }

    if (removeXHRInterceptorRef.current) {
      removeXHRInterceptorRef.current();
      removeXHRInterceptorRef.current = null;
    }

    if (removeWebSocketInterceptorRef.current) {
      removeWebSocketInterceptorRef.current();
      removeWebSocketInterceptorRef.current = null;
    }

    unsubscribe();
  };
  }, [
    queryClient,
    socket,
    deviceName,
    isConnected,
    deviceId,
    enableLogs,
    logPrefix,
    asyncStorage,
    networkMonitoring,
  ]);

  return {
    connect,
    disconnect,
    isConnected,
    socket,
  };
}
