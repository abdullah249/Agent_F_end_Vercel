import { useEffect, useState } from "react";
import { type Agent } from "@shared/schema";
import { wsClient } from "@/lib/websocket";
import AgentCard from "@/components/agent-card";
import VoiceInterface from "@/components/voice-interface";
import MetricsDisplay from "@/components/metrics-display";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void;

    const initializeConnection = () => {
    //  console.log("Initializing data connection");
      
      // Connect to WebSocket or start polling (handled internally by wsClient)
      wsClient.connect();
      
      // Subscribe to agent updates
      unsubscribe = wsClient.subscribe((newAgents) => {
        setAgents(newAgents);
        setIsLoading(false);
      });

      // Subscribe to connection status changes
      wsClient.onConnectionChange((connected) => {
        setIsConnected(connected);
      });
    };

    initializeConnection();

    return () => {
      if (unsubscribe) unsubscribe();
      wsClient.disconnect();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Agent Dashboard
          </h1>
          <p className="text-muted-foreground">
            {isConnected ? (
              <span className="flex items-center text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center text-yellow-500">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                Reconnecting...
              </span>
            )}
          </p>
        </div>
        <VoiceInterface />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      <MetricsDisplay agents={agents} />
    </div>
  );
}
