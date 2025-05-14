import { Socket } from 'socket.io-client';
import { NetworkRequest, NetworkRequestSyncMessage } from './types';
import { log } from './utils/logger';

/**
 * Helper function to send network request data to the dashboard
 *
 * This function should be called by your network interceptors when a request is made,
 * when a response is received, or when an error occurs.
 *
 * @param socket The socket.io client instance
 * @param request The network request data to send
 * @param persistentDeviceId The unique identifier for this device
 * @param enableLogs Whether to enable logging
 */
export function sendNetworkRequest(
  socket: Socket | undefined,
  request: NetworkRequest,
  persistentDeviceId: string,
  enableLogs = false
): void {
  if (!socket) {
    log('Cannot send network request - socket not connected', enableLogs, 'warn');
    return;
  }

  if (!persistentDeviceId) {
    log('Cannot send network request - no persistent device ID', enableLogs, 'warn');
    return;
  }

  const message: NetworkRequestSyncMessage = {
    type: 'network-request-sync',
    request,
    persistentDeviceId,
  };

  log(`Sending network request: ${request.type} ${request.method || ''} ${request.url}`, enableLogs);
  socket.emit('network-request-sync', message);
}

/**
 * Example implementation of fetch interceptor
 *
 * This is an example of how you might implement a fetch interceptor
 * to capture network requests and send them to the dashboard.
 *
 * @param socket The socket.io client instance
 * @param persistentDeviceId The unique identifier for this device
 * @param enableLogs Whether to enable logging
 */
export function setupFetchInterceptor(
  socket: Socket | undefined,
  persistentDeviceId: string,
  enableLogs = false
): () => void {
  if (!socket) {
    log('Cannot set up fetch interceptor - socket not connected', enableLogs, 'warn');
    return () => {};
  }

  if (!persistentDeviceId) {
    log('Cannot set up fetch interceptor - no persistent device ID', enableLogs, 'warn');
    return () => {};
  }

  // Store the original fetch function
  const originalFetch = global.fetch;

  // Replace the global fetch with our interceptor
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Generate a unique ID for this request
    const requestId = Math.random().toString(36).substring(2, 15);

    // Get the URL string
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Get the request method
    const method = init?.method || 'GET';

    // Create the initial request object
    const requestStart = Date.now();
    const initialRequest: NetworkRequest = {
      id: requestId,
      url,
      method,
      type: 'fetch',
      status: 'pending',
      startTime: requestStart,
      persistentDeviceId,
    };

    // Send the initial request to the dashboard
    sendNetworkRequest(socket, initialRequest, persistentDeviceId, enableLogs);

    try {
      // Make the actual fetch request
      const response = await originalFetch(input, init);

      // Clone the response so we can read the body
      const clonedResponse = response.clone();

      // Try to parse the response body
      let responseBody;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          responseBody = await clonedResponse.json();
        } catch (e) {
          responseBody = 'Could not parse JSON response';
        }
      } else if (contentType && contentType.includes('text/')) {
        try {
          responseBody = await clonedResponse.text();
        } catch (e) {
          responseBody = 'Could not parse text response';
        }
      }

      // Create the response headers object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Create the request headers object if available
      const requestHeaders: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            requestHeaders[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            requestHeaders[key] = value;
          });
        } else {
          Object.entries(init.headers).forEach(([key, value]) => {
            requestHeaders[key] = value;
          });
        }
      }

      // Create the updated request object with response data
      const updatedRequest: NetworkRequest = {
        ...initialRequest,
        status: response.ok ? 'success' : 'error',
        endTime: Date.now(),
        duration: Date.now() - requestStart,
        responseStatus: response.status,
        responseBody,
        headers: requestHeaders,
        responseHeaders,
        contentType,
        contentLength: responseBody ? JSON.stringify(responseBody).length : undefined,
      };

      // Send the updated request to the dashboard
      sendNetworkRequest(socket, updatedRequest, persistentDeviceId, enableLogs);

      // Return the original response
      return response;
    } catch (error) {
      // Create the error request object
      const errorRequest: NetworkRequest = {
        ...initialRequest,
        status: 'error',
        endTime: Date.now(),
        duration: Date.now() - requestStart,
        responseBody: error instanceof Error ? error.message : String(error),
      };

      // Send the error request to the dashboard
      sendNetworkRequest(socket, errorRequest, persistentDeviceId, enableLogs);

      // Re-throw the error
      throw error;
    }
  };

  // Return a function to restore the original fetch
  return () => {
    global.fetch = originalFetch;
  };
}

/**
 * Example implementation of XMLHttpRequest interceptor
 *
 * This is an example of how you might implement an XMLHttpRequest interceptor
 * to capture network requests and send them to the dashboard.
 *
 * @param socket The socket.io client instance
 * @param persistentDeviceId The unique identifier for this device
 * @param enableLogs Whether to enable logging
 */
export function setupXHRInterceptor(
  socket: Socket | undefined,
  persistentDeviceId: string,
  enableLogs = false
): () => void {
  if (!socket) {
    log('Cannot set up XHR interceptor - socket not connected', enableLogs, 'warn');
    return () => {};
  }

  if (!persistentDeviceId) {
    log('Cannot set up XHR interceptor - no persistent device ID', enableLogs, 'warn');
    return () => {};
  }

  // Store the original XMLHttpRequest
  const OriginalXHR = global.XMLHttpRequest;

  // Create a new XMLHttpRequest constructor that wraps the original
  function InterceptedXHR() {
    const xhr = new OriginalXHR();
    const requestId = Math.random().toString(36).substring(2, 15);
    let method = '';
    let url = '';
    let requestStart = 0;
    let requestHeaders: Record<string, string> = {};
    let requestBody: any;

    // Override the open method to capture the method and URL
    const originalOpen = xhr.open;
    xhr.open = function(method_: string, url_: string, ...args: any[]) {
      method = method_;
      url = url_;
      return originalOpen.apply(xhr, [method_, url_, ...args]);
    };

    // Override the setRequestHeader method to capture request headers
    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(key, value) {
      requestHeaders[key] = value;
      return originalSetRequestHeader.apply(xhr, [key, value]);
    };

    // Override the send method to capture the request body and start time
    const originalSend = xhr.send;
    xhr.send = function(body) {
      requestStart = Date.now();
      requestBody = body;

      // Create the initial request object
      const initialRequest: NetworkRequest = {
        id: requestId,
        url,
        method,
        type: 'xhr',
        status: 'pending',
        startTime: requestStart,
        persistentDeviceId,
        headers: requestHeaders,
        requestBody,
      };

      // Send the initial request to the dashboard
      sendNetworkRequest(socket, initialRequest, persistentDeviceId, enableLogs);

      return originalSend.apply(xhr, [body]);
    };

    // Listen for the load event to capture the response
    xhr.addEventListener('load', function() {
      // Try to parse the response body
      let responseBody;
      const contentType = xhr.getResponseHeader('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          responseBody = JSON.parse(xhr.responseText);
        } catch (e) {
          responseBody = 'Could not parse JSON response';
        }
      }
      else {
          console.log(xhr);
          responseBody = xhr.responseText;
      }

      // Create the response headers object
      const responseHeaders: Record<string, string> = {};
      const allHeaders = xhr.getAllResponseHeaders();
      const headerLines = allHeaders.split('\r\n');
      headerLines.forEach(line => {
        const parts = line.split(': ');
        if (parts.length === 2) {
          responseHeaders[parts[0]] = parts[1];
        }
      });

      // Create the updated request object with response data
      const updatedRequest: NetworkRequest = {
        id: requestId,
        url,
        method,
        type: 'xhr',
        status: xhr.status >= 200 && xhr.status < 300 ? 'success' : 'error',
        startTime: requestStart,
        endTime: Date.now(),
        duration: Date.now() - requestStart,
        persistentDeviceId,
        headers: requestHeaders,
        requestBody,
        responseStatus: xhr.status,
        responseBody,
        responseHeaders,
        contentType,
        contentLength: responseBody ? JSON.stringify(responseBody).length : undefined,
      };

      // Send the updated request to the dashboard
      sendNetworkRequest(socket, updatedRequest, persistentDeviceId, enableLogs);
    });

    // Listen for the error event to capture errors
    xhr.addEventListener('error', function() {
      // Create the error request object
      const errorRequest: NetworkRequest = {
        id: requestId,
        url,
        method,
        type: 'xhr',
        status: 'error',
        startTime: requestStart,
        endTime: Date.now(),
        duration: Date.now() - requestStart,
        persistentDeviceId,
        headers: requestHeaders,
        requestBody,
        responseBody: 'Network error',
      };

      // Send the error request to the dashboard
      sendNetworkRequest(socket, errorRequest, persistentDeviceId, enableLogs);
    });

    return xhr;
  }

  // Replace the global XMLHttpRequest with our interceptor
  global.XMLHttpRequest = InterceptedXHR as any;

  // Return a function to restore the original XMLHttpRequest
  return () => {
    global.XMLHttpRequest = OriginalXHR;
  };
}

/**
 * Example implementation of WebSocket interceptor
 *
 * This is an example of how you might implement a WebSocket interceptor
 * to capture WebSocket messages and send them to the dashboard.
 *
 * @param socket The socket.io client instance
 * @param persistentDeviceId The unique identifier for this device
 * @param enableLogs Whether to enable logging
 */
export function setupWebSocketInterceptor(
  socket: Socket | undefined,
  persistentDeviceId: string,
  enableLogs = false
): () => void {
  if (!socket) {
    log('Cannot set up WebSocket interceptor - socket not connected', enableLogs, 'warn');
    return () => {};
  }

  if (!persistentDeviceId) {
    log('Cannot set up WebSocket interceptor - no persistent device ID', enableLogs, 'warn');
    return () => {};
  }

  // Store the original WebSocket
  const OriginalWebSocket = global.WebSocket;

  // Create a new WebSocket constructor that wraps the original
  function InterceptedWebSocket(url: string, protocols?: string | string[]) {
    const ws = new OriginalWebSocket(url, protocols);
    const connectionId = Math.random().toString(36).substring(2, 15);
    const connectionStart = Date.now();

    // Create the initial connection request
    const initialRequest: NetworkRequest = {
      id: connectionId,
      url,
      type: 'websocket',
      status: 'pending',
      startTime: connectionStart,
      persistentDeviceId,
      direction: 'sent',
    };

    // Send the initial connection request to the dashboard
    sendNetworkRequest(socket, initialRequest, persistentDeviceId, enableLogs);

    // Listen for the open event
    ws.addEventListener('open', function() {
      // Create the open connection request
      const openRequest: NetworkRequest = {
        ...initialRequest,
        status: 'success',
        endTime: Date.now(),
        duration: Date.now() - connectionStart,
      };

      // Send the open connection request to the dashboard
      sendNetworkRequest(socket, openRequest, persistentDeviceId, enableLogs);
    });

    // Listen for the message event
    ws.addEventListener('message', function(event) {
      // Create a unique ID for this message
      const messageId = `${connectionId}-${Math.random().toString(36).substring(2, 15)}`;

      // Try to parse the message data
      let messageData;
      try {
        messageData = JSON.parse(event.data);
      } catch (e) {
        messageData = event.data;
      }

      // Create the message request
      const messageRequest: NetworkRequest = {
        id: messageId,
        url,
        type: 'websocket',
        status: 'success',
        startTime: Date.now(),
        persistentDeviceId,
        direction: 'received',
        data: messageData,
      };

      // Send the message request to the dashboard
      sendNetworkRequest(socket, messageRequest, persistentDeviceId, enableLogs);
    });

    // Override the send method to capture outgoing messages
    const originalSend = ws.send;
    ws.send = function(data) {
      // Create a unique ID for this message
      const messageId = `${connectionId}-${Math.random().toString(36).substring(2, 15)}`;

      // Try to parse the message data
      let messageData;
      if (typeof data === 'string') {
        try {
          messageData = JSON.parse(data);
        } catch (e) {
          messageData = data;
        }
      } else {
        messageData = data;
      }

      // Create the message request
      const messageRequest: NetworkRequest = {
        id: messageId,
        url,
        type: 'websocket',
        status: 'success',
        startTime: Date.now(),
        persistentDeviceId,
        direction: 'sent',
        data: messageData,
      };

      // Send the message request to the dashboard
      sendNetworkRequest(socket, messageRequest, persistentDeviceId, enableLogs);

      return originalSend.apply(ws, [data]);
    };

    // Listen for the close event
    ws.addEventListener('close', function() {
      // Create the close connection request
      const closeRequest: NetworkRequest = {
        id: `${connectionId}-close`,
        url,
        type: 'websocket',
        status: 'success',
        startTime: Date.now(),
        persistentDeviceId,
        direction: 'sent',
        data: { type: 'connection-closed' },
      };

      // Send the close connection request to the dashboard
      sendNetworkRequest(socket, closeRequest, persistentDeviceId, enableLogs);
    });

    // Listen for the error event
    ws.addEventListener('error', function(event) {
      // Create the error connection request
      const errorRequest: NetworkRequest = {
        id: `${connectionId}-error`,
        url,
        type: 'websocket',
        status: 'error',
        startTime: Date.now(),
        persistentDeviceId,
        direction: 'received',
        data: { type: 'connection-error', error: 'WebSocket connection error' },
      };

      // Send the error connection request to the dashboard
      sendNetworkRequest(socket, errorRequest, persistentDeviceId, enableLogs);
    });

    return ws;
  }

  // Replace the global WebSocket with our interceptor
  global.WebSocket = InterceptedWebSocket as any;

  // Return a function to restore the original WebSocket
  return () => {
    global.WebSocket = OriginalWebSocket;
  };
}

/**
 * Set up all network interceptors
 *
 * This function sets up interceptors for fetch, XMLHttpRequest, and WebSocket
 * to capture network requests and send them to the dashboard.
 *
 * @param socket The socket.io client instance
 * @param persistentDeviceId The unique identifier for this device
 * @param enableLogs Whether to enable logging
 */
export function setupNetworkInterceptors(
  socket: Socket | undefined,
  persistentDeviceId: string,
  enableLogs = false
): () => void {
  const removeFetchInterceptor = setupFetchInterceptor(socket, persistentDeviceId, enableLogs);
  const removeXHRInterceptor = setupXHRInterceptor(socket, persistentDeviceId, enableLogs);
  const removeWebSocketInterceptor = setupWebSocketInterceptor(socket, persistentDeviceId, enableLogs);

  // Return a function to remove all interceptors
  return () => {
    removeFetchInterceptor();
    removeXHRInterceptor();
    removeWebSocketInterceptor();
  };
}
