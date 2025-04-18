// import { type Agent } from "@shared/schema";

// export type WSMessage = {
//   type: string;
//   data: any;
// };

// class WebSocketClient {
//   private ws: WebSocket | null = null;
//   private listeners: ((agents: Agent[]) => void)[] = [];
//   private connectionListeners: ((connected: boolean) => void)[] = [];
//   private reconnectTimeout: number = 1000; // Start with 1 second
//   private reconnectAttempts: number = 0;
//   private maxReconnectAttempts: number = 10; // Increase max attempts
//   private pollingInterval: NodeJS.Timeout | null = null;
//   private isPolling: boolean = false;
//   private isConnected: boolean = false;
//   private apiBaseUrl: string = '';

//   connect(useDirectConnection = false) {
//     // Check if we're in development or production
//     const isProduction = window.location.hostname !== 'localhost';
    
//     if (isProduction) {
//       console.log("Running in production environment, using polling instead of WebSocket");
//       this.startPolling();
//       return;
//     }
    
//     // Only try WebSocket in development
//     if (this.ws?.readyState === WebSocket.OPEN) return;

//     const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
//     const wsUrl = `${protocol}//${window.location.host}/ws`;
//     console.log("Using WebSocket connection:", wsUrl);

//     try {
//       this.ws = new WebSocket(wsUrl);

//       this.ws.onmessage = (event) => {
//         try {
//           const message: WSMessage = JSON.parse(event.data);
//           if (message.type === "agents_update") {
//             this.listeners.forEach(listener => listener(message.data));
//           }
//         } catch (error) {
//           console.error("WebSocket message parsing error:", error);
//         }
//       };

//       this.ws.onopen = () => {
//         console.log("WebSocket connected");
//         this.reconnectTimeout = 1000; // Reset timeout on successful connection
//         this.reconnectAttempts = 0;
//         this.isConnected = true;
//         this.notifyConnectionChange(true);
//       };

//       this.ws.onclose = () => {
//         console.log("WebSocket disconnected, attempting reconnect...");
//         this.isConnected = false;
//         this.notifyConnectionChange(false);

//         if (this.reconnectAttempts < this.maxReconnectAttempts) {
//           setTimeout(() => {
//             this.reconnectTimeout = Math.min(this.reconnectTimeout * 1.5, 30000); // Exponential backoff
//             this.reconnectAttempts++;
//             this.connect(useDirectConnection);
//           }, this.reconnectTimeout);
//         } else {
//           console.error("Max reconnection attempts reached, switching to polling");
//           this.startPolling();
//         }
//       };

//       this.ws.onerror = (error) => {
//         console.error("WebSocket error:", error);
//       };
//     } catch (error) {
//       console.error("Error creating WebSocket:", error);
//       this.startPolling();
//     }
//   }

//   private startPolling() {
//     if (this.isPolling) return;
    
//     console.log("Starting polling for agents data");
//     this.isPolling = true;
//     this.isConnected = true;
//     this.notifyConnectionChange(true);
    
//     // Determine API base URL - always use relative URL in production to leverage Vercel's routes
//     this.apiBaseUrl = '/api';
//     console.log("Using API base URL:", this.apiBaseUrl);
    
//     // Poll immediately
//     this.pollAgents();
    
//     // Then set up interval
//     this.pollingInterval = setInterval(() => {
//       this.pollAgents();
//     }, 5000); // Poll every 5 seconds
//   }
  
//   private async pollAgents() {
//     try {
//       console.log(`Fetching agents from: ${this.apiBaseUrl}/agents`);
//       const response = await fetch(`${this.apiBaseUrl}/agents`, {
//         headers: {
//           'Accept': 'application/json',
//           'Content-Type': 'application/json'
//         }
//       });
      
//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText} - ${errorText}`);
//       }
      
//       const agents = await response.json();
//       console.log("Successfully fetched agents:", agents.length);
//       this.listeners.forEach(listener => listener(agents));
//     } catch (error) {
//       console.error("Error polling agents:", error);
//       // Try to provide more detailed error information
//       if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
//         console.error("Network error - this could be due to CORS issues or the API server being unreachable");
//       }
//     }
//   }

//   disconnect() {
//     if (this.ws) {
//       this.ws.close();
//       this.ws = null;
//     }
    
//     if (this.pollingInterval) {
//       clearInterval(this.pollingInterval);
//       this.pollingInterval = null;
//       this.isPolling = false;
//     }
    
//     this.isConnected = false;
//     this.notifyConnectionChange(false);
//   }

//   subscribe(listener: (agents: Agent[]) => void) {
//     this.listeners.push(listener);
//     return () => {
//       this.listeners = this.listeners.filter(l => l !== listener);
//     };
//   }

//   onConnectionChange(listener: (connected: boolean) => void) {
//     this.connectionListeners.push(listener);
//     // Immediately notify with current state
//     listener(this.isConnected);
//     return () => {
//       this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
//     };
//   }

//   private notifyConnectionChange(connected: boolean) {
//     this.isConnected = connected;
//     this.connectionListeners.forEach(listener => listener(connected));
//   }

//   updateAgentStatus(agentId: number, status: string) {
//     if (this.isPolling) {
//       // Use REST API instead of WebSocket
//       fetch(`${this.apiBaseUrl}/agents/${agentId}/status`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({ status })
//       }).catch(error => {
//         console.error("Error updating agent status:", error);
//       });
//     } else if (this.ws?.readyState === WebSocket.OPEN) {
//       this.ws.send(JSON.stringify({ type: "update_status", agentId, status }));
//     }
//   }

//   updateMetrics(agentId: number, metrics: any) {
//     if (this.isPolling) {
//       // Use REST API instead of WebSocket
//       fetch(`${this.apiBaseUrl}/agents/${agentId}/metrics`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({ metrics })
//       }).catch(error => {
//         console.error("Error updating agent metrics:", error);
//       });
//     } else if (this.ws?.readyState === WebSocket.OPEN) {
//       this.ws.send(JSON.stringify({ type: "update_metrics", agentId, metrics }));
//     }
//   }
// }

// export const wsClient = new WebSocketClient();





// Test for frontend on vercel by haseeb 
import { type Agent } from "@shared/schema";

export type WSMessage = {
  type: string;
  data: any;
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: ((agents: Agent[]) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private reconnectTimeout: number = 1000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private isConnected: boolean = false;
  private apiBaseUrl: string = '';

  connect(useDirectConnection = false) {
    const isProduction = window.location.hostname !== 'localhost';
    const backendHost = isProduction
      ? 'https://agent-backend-typescript.onrender.com' //  Replace with actual Render domain by haseeb
      : window.location.host;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = isProduction
      ? `wss://${backendHost}/ws`
      : `${protocol}//${backendHost}/ws`;

    if (isProduction) {
      console.log("Running in production environment, using polling instead of WebSocket");
      this.startPolling(isProduction, backendHost);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) return;

    console.log("Using WebSocket connection:", wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          if (message.type === "agents_update") {
            this.listeners.forEach(listener => listener(message.data));
          }
        } catch (error) {
          console.error("WebSocket message parsing error:", error);
        }
      };

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectTimeout = 1000;
        this.reconnectAttempts = 0;
        this.isConnected = true;
        this.notifyConnectionChange(true);
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected, attempting reconnect...");
        this.isConnected = false;
        this.notifyConnectionChange(false);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectTimeout = Math.min(this.reconnectTimeout * 1.5, 30000);
            this.reconnectAttempts++;
            this.connect(useDirectConnection);
          }, this.reconnectTimeout);
        } else {
          console.error("Max reconnection attempts reached, switching to polling");
          this.startPolling(isProduction, backendHost);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      this.startPolling(isProduction, backendHost);
    }
  }

  private startPolling(isProduction = false, backendHost = '') {
    if (this.isPolling) return;

    console.log("Starting polling for agents data");
    this.isPolling = true;
    this.isConnected = true;
    this.notifyConnectionChange(true);

    this.apiBaseUrl = isProduction
      ? `https://${backendHost}/api`
      : '/api';

    console.log("Using API base URL:", this.apiBaseUrl);

    this.pollAgents();
    this.pollingInterval = setInterval(() => {
      this.pollAgents();
    }, 5000);
  }

  private async pollAgents() {
    try {
      console.log(`Fetching agents from: ${this.apiBaseUrl}/agents`);
      const response = await fetch(`${this.apiBaseUrl}/agents`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const agents = await response.json();
      console.log("Successfully fetched agents:", agents.length);
      this.listeners.forEach(listener => listener(agents));
    } catch (error) {
      console.error("Error polling agents:", error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error("Network error - this could be due to CORS issues or the API server being unreachable");
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
    }

    this.isConnected = false;
    this.notifyConnectionChange(false);
  }

  subscribe(listener: (agents: Agent[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.push(listener);
    listener(this.isConnected);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  private notifyConnectionChange(connected: boolean) {
    this.isConnected = connected;
    this.connectionListeners.forEach(listener => listener(connected));
  }

  updateAgentStatus(agentId: number, status: string) {
    if (this.isPolling) {
      fetch(`${this.apiBaseUrl}/agents/${agentId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      }).catch(error => {
        console.error("Error updating agent status:", error);
      });
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "update_status", agentId, status }));
    }
  }

  updateMetrics(agentId: number, metrics: any) {
    if (this.isPolling) {
      fetch(`${this.apiBaseUrl}/agents/${agentId}/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metrics })
      }).catch(error => {
        console.error("Error updating agent metrics:", error);
      });
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "update_metrics", agentId, metrics }));
    }
  }
}

export const wsClient = new WebSocketClient();
