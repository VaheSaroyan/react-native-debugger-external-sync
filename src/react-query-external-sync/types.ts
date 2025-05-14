import {
  DefaultError,
  MutationKey,
  MutationMeta,
  MutationScope,
  MutationState,
  QueryKey,
  QueryMeta,
  QueryObserverOptions,
  QueryState,
} from "@tanstack/react-query";
// Define a simplified version of DehydratedState that both versions can work with
export interface SimpleDehydratedState {
  mutations: unknown[];
  queries: unknown[];
}

export interface SyncMessage {
  type: "dehydrated-state";
  state: DehydratedState;
  isOnlineManagerOnline: boolean;
  persistentDeviceId: string;
}

export interface DehydratedState {
  mutations: DehydratedMutation[];
  queries: DehydratedQuery[];
}

export interface DehydratedMutation {
  mutationId: number;
  mutationKey?: MutationKey;
  state: MutationState;
  meta?: MutationMeta;
  scope?: MutationScope;
  gcTime?: number;
}
export interface DehydratedQuery {
  queryHash: string;
  queryKey: QueryKey;
  state: QueryState;
  promise?: Promise<unknown>;
  meta?: QueryMeta;
  observers: ObserverState[];
  gcTime?: number;
}
export interface ObserverState<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> {
  queryHash: string;
  options: QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >;
}

export interface User {
  id: string;
  deviceName: string;
  deviceId: string; // Persisted device ID
  platform?: string; // Device platform (iOS, Android, Web)
  isConnected?: boolean; // Whether the device is currently connected
  extraDeviceInfo?: string; // json string of additional device information as key-value pairs
}


// Types for AsyncStorage operations
export interface AsyncStorageItem {
    key: string;
    value: string;
}

export interface AsyncStorageState {
    items: AsyncStorageItem[];
    timestamp: number;
}

// Message sent from React Native app to DevTools
export interface AsyncStorageSyncMessage {
    type: "async-storage-state";
    state: AsyncStorageState;
    persistentDeviceId: string;
}

// Message sent from DevTools to React Native app
export interface AsyncStorageActionMessage {
    type: "async-storage-action";
    action: AsyncStorageActionType;
    targetDeviceId: string; // Device ID of the target device
    key?: string;
    value?: string;
}

// Message to request initial AsyncStorage state
export interface AsyncStorageRequestMessage {
    type: "request-async-storage";
    targetDeviceId: string;
}

// Action types for AsyncStorage operations
export type AsyncStorageActionType =
    | "GET_ALL_KEYS"
    | "GET_ITEM"
    | "SET_ITEM"
    | "REMOVE_ITEM"
    | "CLEAR_ALL";

// Network Monitoring Types

/**
 * Types of network requests that can be monitored
 */
export type NetworkRequestType = 
  | "fetch" 
  | "xhr" 
  | "websocket" 
  | "graphql";

/**
 * Status of a network request
 */
export type NetworkRequestStatus = 
  | "pending" 
  | "success" 
  | "error";

/**
 * Direction of WebSocket messages
 */
export type WebSocketDirection = 
  | "sent" 
  | "received";

/**
 * Base interface for all network requests
 */
export interface BaseNetworkRequest {
  id: string;
  url: string;
  method?: string;
  type: NetworkRequestType;
  status: NetworkRequestStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  persistentDeviceId: string;
}

/**
 * Interface for HTTP requests (fetch/XHR)
 */
export interface HttpNetworkRequest extends BaseNetworkRequest {
  type: "fetch" | "xhr";
  method: string;
  headers?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  responseStatus?: number;
  responseStatusText?: string;
  responseHeaders?: Record<string, string>;
  contentType?: string;
  contentLength?: number;
}

/**
 * Interface for WebSocket messages
 */
export interface WebSocketNetworkRequest extends BaseNetworkRequest {
  type: "websocket";
  direction: WebSocketDirection;
  data?: any;
  messageType?: string;
}

/**
 * Interface for GraphQL requests
 */
export interface GraphQLNetworkRequest extends BaseNetworkRequest {
  type: "graphql";
  method: string;
  operationName?: string;
  operationType?: "query" | "mutation" | "subscription";
  variables?: any;
  response?: any;
  responseStatus?: number;
}

/**
 * Union type for all network request types
 */
export type NetworkRequest = 
  | HttpNetworkRequest 
  | WebSocketNetworkRequest 
  | GraphQLNetworkRequest;

/**
 * Message structure for network request sync from devices to dashboard
 */
export interface NetworkRequestSyncMessage {
  type: "network-request-sync";
  request: NetworkRequest;
  persistentDeviceId: string;
}

/**
 * Message structure for requesting network requests from devices
 */
export interface NetworkRequestMessage {
  type: "request-network-monitoring";
  targetDeviceId: string;
}

/**
 * Message structure for network monitoring actions from dashboard to devices
 */
export interface NetworkMonitoringActionMessage {
  action: "ACTION-ENABLE-NETWORK-MONITORING" | "ACTION-DISABLE-NETWORK-MONITORING";
  targetDeviceId: string;
}

/**
 * State structure for network request store
 */
export interface NetworkRequestState {
  requests: NetworkRequest[];
  isEnabled: boolean;
}
