import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Activity, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { voiceService } from "@/lib/voice-service";
import { conversationManager } from "@/lib/conversation-manager";
import { useToast } from "@/hooks/use-toast";
import VoiceSettings from "./voice-settings";
import VoiceCommands from "./voice-commands";
import ConversationDisplay from "./conversation-display";
import VoiceToneCustomizer from "./voice-tone-customizer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// Single source of digital twins with their expertise areas
const digitalTwins = [
  {
    id: "albert-einstein",
    name: "Albert Einstein",
    expertise: ["Innovation", "Research", "Problem Solving"],
    contentFile: "Persona Albert Einstein.docx"
  },
  {
    id: "elon-musk",
    name: "Elon Musk",
    expertise: ["Innovation", "Strategic Thinking", "Product Development"],
    contentFile: "Persona Elon Musk.docx"
  },
  {
    id: "emad-mostaque",
    name: "Emad Mostaque",
    expertise: ["Artificial Intelligence", "Leadership", "Technical Vision"],
    contentFile: "Emad Mostaque.docx"
  },
  {
    id: "fei-fei-li",
    name: "Fei-Fei Li",
    expertise: ["Artificial Intelligence", "Research", "Technical Vision"],
    contentFile: "Persona is Fei-Fei Li.docx"
  },
  {
    id: "leonardo-da-vinci",
    name: "Leonardo da Vinci",
    expertise: ["Innovation", "Art", "Engineering", "Design Thinking"],
    contentFile: "leonardo.docx"
  },
  {
    id: "steve-jobs",
    name: "Steve Jobs",
    expertise: ["Innovation", "Product Development", "Design"],
    contentFile: "persona steve.docx"
  },
  {
    id: "walt-disney",
    name: "Walt Disney",
    expertise: ["Creativity", "Innovation", "Storytelling"],
    contentFile: "Walt disney.docx"
  }
];

export default function VoiceInterface() {
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [noSpeechTimeout, setNoSpeechTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Log digital twins to console on component mount
    console.log("Digital Twins in Our Think Tank:");
    digitalTwins.forEach((twin, index) => {
      console.log(`${index + 1}. ${twin.name} - Expert in: ${twin.expertise.join(", ")}`);
    });
  }, []);

  // Handle persona selection
  const handlePersonaChange = (personaName: string) => {
    setSelectedPersona(personaName);
    conversationManager.setSelectedPersona(personaName);

    toast({
      title: "Persona Selected",
      description: `You are now conversing with ${personaName}`,
    });
  };

  const initializeRecognition = () => {
    try {
      const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognition) {
        toast({
          title: "Browser Not Supported",
          description: "Please use Chrome, Edge, or Safari for voice features.",
          variant: "destructive",
        });
        return false;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        console.log("Speech recognition started");
        setIsListening(true);
        setIsInitializing(false);
      };

      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended");
        setIsListening(false);
        setTranscript("");
        setIsInitializing(false);
        if (noSpeechTimeout) {
          clearTimeout(noSpeechTimeout);
          setNoSpeechTimeout(null);
        }
      };

      recognitionRef.current.onresult = (event: any) => {
        try {
          const result = event.results[event.resultIndex];
          const transcript = result[0].transcript;
          console.log("Speech recognition result:", transcript);
          setTranscript(transcript);

          if (result.isFinal) {
            handleFinalTranscript(transcript);
          }
        } catch (error) {
          console.error("Error processing speech result:", error);
          setError("Failed to process speech. Please try again.");
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setIsInitializing(false);

        if (event.error === 'no-speech') {
          setError("No speech detected. Please try speaking again.");
        } else if (event.error === 'not-allowed') {
          setError("Microphone access denied. Please allow access in your browser settings.");
        } else {
          setError(`Voice recognition error: ${event.error}`);
        }
      };

      return true;
    } catch (error) {
      console.error("Error initializing speech recognition:", error);
      setError("Failed to initialize voice recognition. Please refresh the page.");
      return false;
    }
  };

  const handleFinalTranscript = async (text: string) => {
    if (!text.trim()) return;
    setTranscript("");

    // Check if a persona is selected
    if (!selectedPersona) {
      setError("Please select a persona before starting a conversation");
      return;
    }

    try {
      await conversationManager.handleUserInput(text);
      setError(null); // Clear any previous errors on successful processing
    } catch (error: any) {
      console.error("Error processing speech:", error);
      setError(error.message || "Failed to process your input. Please try again.");
    }
  };

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setIsPermissionGranted(true);
      return initializeRecognition();
    } catch (error) {
      console.error("Microphone permission error:", error);
      setError("Microphone access required. Please allow access to use voice features.");
      return false;
    }
  };

  const toggleListening = async () => {
    if (isInitializing) return;

    // Check if a persona is selected
    if (!selectedPersona) {
      setError("Please select a persona before starting a conversation");
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      if (!isPermissionGranted) {
        const initialized = await checkMicrophonePermission();
        if (!initialized) {
          setIsInitializing(false);
          return;
        }
      }

      if (!isListening) {
        await voiceService.initAudio();
        await conversationManager.startConversation();
        recognitionRef.current?.start();
      } else {
        if (noSpeechTimeout) {
          clearTimeout(noSpeechTimeout);
          setNoSpeechTimeout(null);
        }
        recognitionRef.current?.stop();
      }
    } catch (error: any) {
      console.error("Voice interface error:", error);
      setError(error.message || "Failed to initialize voice interface. Please try again.");
      setIsListening(false);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isListening) {
        setProgress(p => (p + 2) % 100);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isListening]);


  return (
    <div className="w-full min-h-[200px] flex flex-col gap-6 p-6">
      {/* Persona Selection */}
      <Card className="w-full bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="flex flex-row items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Select Conversation Partner</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Choose who you want to talk with</Label>
            <Select
              value={selectedPersona || ""}
              onValueChange={handlePersonaChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a persona" />
              </SelectTrigger>
              <SelectContent>
                {digitalTwins.map((twin) => (
                  <SelectItem key={twin.id} value={twin.name}>
                    {twin.name} - {twin.expertise.join(", ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-4">
        <Button
          variant={isListening ? "destructive" : "default"}
          size="lg"
          className="w-full max-w-md relative bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:opacity-50"
          onClick={toggleListening}
          disabled={isInitializing || !selectedPersona}
        >
          <div className="relative flex items-center justify-center">
            {isInitializing ? (
              "Initializing..."
            ) : isListening ? (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Start Listening
              </>
            )}
          </div>
        </Button>

        {error && (
          <div className="text-sm text-destructive text-center max-w-md">
            {error}
          </div>
        )}

        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-md space-y-2"
            >
              <div className="relative h-8">
                <Progress value={progress} className="h-2" />
                {transcript && (
                  <div className="text-sm text-muted-foreground text-center mt-2">
                    {transcript}
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Activity className="h-5 w-5 text-primary animate-pulse" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full space-y-4">
        <ConversationDisplay />
        <VoiceSettings />
        <VoiceToneCustomizer />
        <VoiceCommands />
      </div>
    </div>
  );
}
