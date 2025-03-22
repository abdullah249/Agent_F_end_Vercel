import { voiceService } from './voice-service';
import OpenAI from "openai";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  persona?: string;
}

interface ConversationContext {
  lastQuery?: string;
  lastResponse?: string;
  topic?: string;
  turnCount: number;
  messages: Message[];
  activePersonas?: string[];
  currentSpeaker?: string;
}

export class ConversationManager {
  private context: ConversationContext = {
    turnCount: 0,
    messages: [],
    activePersonas: [],
    currentSpeaker: undefined
  };

  private openai: OpenAI;
  private isInitialized: boolean = false;
  private selectedPersona: string | null = null;
  private isSpeaking: boolean = false;

  constructor() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key is required');
    }

    console.log('Initializing OpenAI client with API key format:', apiKey.substring(0, 10) + '...');

    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  // Method to set the selected persona
  setSelectedPersona(persona: string): void {
    this.selectedPersona = persona;
    this.context.activePersonas = [persona];
    console.log(`Selected persona: ${persona}`);

    // Reset conversation if it was already initialized
    if (this.isInitialized) {
      this.isInitialized = false;
      this.context.messages = [];
      this.context.turnCount = 0;
    }
  }

  // Get the currently selected persona
  getSelectedPersona(): string | null {
    return this.selectedPersona;
  }

  async startConversation(): Promise<void> {
    if (this.isInitialized) {
      console.log('Conversation already initialized');
      return;
    }

    // Check if a persona is selected
    if (!this.selectedPersona) {
      console.error('No persona selected');
      throw new Error('Please select a persona before starting a conversation');
    }

    try {
      console.log(`Initializing conversation with ${this.selectedPersona}`);

      // Create a system message for a conversation with the selected persona
      const systemMessage: Message = {
        role: "system",
        content: `You are ${this.selectedPersona}, having a one-on-one conversation with the user about innovation, creativity, and design thinking.
        Respond as ${this.selectedPersona} would, with their unique perspective, knowledge, and personality.
        
        Keep your responses concise (1-3 sentences) to maintain a natural conversational flow.
        
        ${this.getPersonaInstructions(this.selectedPersona)}`
      };

      const initialPrompt = `Hello ${this.selectedPersona}, I'd like to discuss innovation and creativity with you.`;

      this.context.messages = [systemMessage];
      this.context.topic = "innovation, creativity, and design thinking";
      this.isInitialized = true;

      // Initialize audio system before starting conversation
      try {
        await voiceService.initAudio();
      } catch (error) {
        console.warn('Failed to initialize audio, continuing without audio initialization:', error);
      }

      // Don't automatically start the conversation, wait for user input
    } catch (error) {
      console.error('Failed to start conversation:', error);
      this.isInitialized = false;

      // Don't rethrow the error, just log it and continue
      // This prevents the application from crashing if conversation fails to start
      console.log('Conversation initialization failed, but application will continue');
    }
  }

  // Helper method to get persona-specific instructions
  private getPersonaInstructions(persona: string): string {
    switch (persona) {
      case "Leonardo da Vinci":
        return `As Leonardo da Vinci:
        - Draw insights from nature and art
        - Speak thoughtfully about observation and universal principles
        - Reference your studies of birds, anatomy, and natural phenomena
        - Connect renaissance thinking to modern design principles`;

      case "Steve Jobs":
        return `As Steve Jobs:
        - Focus on user experience and design simplicity
        - Reference Apple products and modern technology
        - Emphasize the importance of aesthetics and functionality
        - Be passionate about revolutionary ideas`;

      case "Albert Einstein":
        return `As Albert Einstein:
        - Emphasize the importance of curiosity and imagination
        - Speak about the interconnectedness of science and art
        - Reference your theories and their implications
        - Share your philosophical views on creativity and problem-solving`;

      case "Elon Musk":
        return `As Elon Musk:
        - Focus on ambitious, world-changing goals
        - Reference your companies (Tesla, SpaceX, etc.) and their missions
        - Emphasize first principles thinking and engineering solutions
        - Share your views on the future of technology and humanity`;

      case "Walt Disney":
        return `As Walt Disney:
        - Emphasize the power of imagination and storytelling
        - Reference your animation innovations and theme park concepts
        - Focus on creating magical experiences and emotional connections
        - Share your philosophy on entertainment and creativity`;

      default:
        return `Embody the unique perspective, knowledge, and personality of ${persona}.`;
    }
  }

  async handleUserInput(input: string): Promise<void> {
    if (!input.trim()) return;

    // If already speaking, don't process new input
    if (this.isSpeaking) {
      console.log('Already speaking, ignoring new input');
      return;
    }

    try {
      if (!this.isInitialized) {
        try {
          await this.startConversation();
        } catch (error) {
          console.error('Failed to initialize conversation during handleUserInput:', error);
        }
      }

      this.context.turnCount++;
      this.context.lastQuery = input;

      this.context.messages.push({
        role: "user",
        content: input
      });

      console.log('Sending request to OpenAI...');
      try {
        console.log('Using OpenAI to generate response...');

        let aiResponse: string;

        try {
          console.log('Using proxy endpoint for OpenAI request');
          const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

          // First try with gpt-4o
          try {
            console.log('Attempting with gpt-4o model');
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: "gpt-4o",
                messages: this.context.messages,
                temperature: 0.85,
                max_tokens: 120,
                presence_penalty: 0.7,
                frequency_penalty: 0.5
              })
            });

            // Check for quota exceeded error
            if (response.status === 429) {
              const errorData = await response.json();
              if (errorData.error && errorData.error.type === "insufficient_quota") {
                console.warn('OpenAI quota exceeded, falling back to gpt-3.5-turbo');
                throw new Error('quota_exceeded');
              }
            }

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;

            if (!content) {
              throw new Error("No response received from AI");
            }

            aiResponse = content;
          } catch (modelError: any) {
            if (modelError.message === 'quota_exceeded' ||
              (modelError.message && modelError.message.includes('quota'))) {
              console.log('Falling back to gpt-3.5-turbo due to quota limits');

              const fallbackResponse = await fetch('/api/openai/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  model: "gpt-3.5-turbo",
                  messages: this.context.messages,
                  temperature: 0.85,
                  max_tokens: 120,
                  presence_penalty: 0.7,
                  frequency_penalty: 0.5
                })
              });

              if (!fallbackResponse.ok) {
                const errorText = await fallbackResponse.text();
                throw new Error(`OpenAI API error with fallback model: ${fallbackResponse.status} - ${errorText}`);
              }

              const data = await fallbackResponse.json();
              const content = data.choices[0]?.message?.content;

              if (!content) {
                throw new Error("No response received from AI with fallback model");
              }

              aiResponse = content;
            } else {
              // If it's not a quota error, rethrow
              throw modelError;
            }
          }
        } catch (proxyError) {
          console.error('Proxy endpoint failed, falling back to direct OpenAI SDK:', proxyError);
          try {
            const response = await this.openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: this.context.messages,
              temperature: 0.85,
              max_tokens: 120,
              presence_penalty: 0.7,
              frequency_penalty: 0.5
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
              throw new Error("No response received from AI");
            }

            aiResponse = content;
          } catch (sdkError) {
            console.error('OpenAI SDK also failed:', sdkError);
            throw sdkError;
          }
        }

        // Use the selected persona as the speaker
        const currentSpeaker = this.selectedPersona || "Assistant";
        console.log('Speaking as:', currentSpeaker);

        this.context.messages.push({
          role: "assistant",
          content: aiResponse,
          persona: currentSpeaker
        });

        this.context.lastResponse = aiResponse;

        this.isSpeaking = true;

        // Try to speak the response, but don't block the conversation if it fails
        try {
          await this.speak(aiResponse, currentSpeaker);
        } catch (speakError) {
          console.error('Error in speech synthesis, continuing without speech:', speakError);
        } finally {
          this.isSpeaking = false;
        }
      } catch (aiError: any) {
        console.error('Error getting AI response:', aiError);

        // Create a fallback response
        const fallbackResponse = "I'm having trouble connecting to the AI service. Let's continue our conversation. What would you like to discuss?";
        const fallbackSpeaker = this.selectedPersona || "Assistant";

        this.context.messages.push({
          role: "assistant",
          content: fallbackResponse,
          persona: fallbackSpeaker
        });

        this.context.lastResponse = fallbackResponse;
        this.isSpeaking = true;

        try {
          await this.speak(fallbackResponse, fallbackSpeaker);
        } catch (speakError) {
          console.error('Error in fallback speech synthesis:', speakError);
        } finally {
          // Reset speaking flag when done
          this.isSpeaking = false;
        }
      }
    } catch (error: any) {
      console.error('Unhandled error in conversation:', error);
      const errorMessage = error.message.includes('quota_exceeded')
        ? "Voice synthesis quota exceeded. Please try again later."
        : "I apologize, but I'm having trouble processing that request. Could you try again?";

      this.isSpeaking = true;

      try {
        await this.speak(errorMessage);
      } catch (speakError) {
        console.error('Error speaking error message:', speakError);
      } finally {
        // Reset speaking flag when done
        this.isSpeaking = false;
      }
      console.log('Conversation error handled, application will continue');
    }
  }

  private async speak(text: string, persona?: string): Promise<void> {
    if (!text.trim()) return;

    try {
      console.log(`Attempting to speak as ${persona || 'default'}: "${text.substring(0, 30)}..."`);

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Speech synthesis timed out'));
        }, 10000); // 10 second timeout
      });

      // Try to synthesize speech with a timeout
      await Promise.race([
        voiceService.synthesizeSpeech({
          text,
          persona
        }),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('Error in speech synthesis:', error);
      console.log('Speech synthesis failed, continuing without speech');
    }
  }

  async saveCurrentTranscript(): Promise<string> {
    return this.context.messages
      .filter(m => m.role === "assistant" || m.role === "user")
      .map(m => m.content)
      .join("\n\n");
  }

  async saveToKnowledgeBase(): Promise<void> {
    try {
      const transcript = await this.saveCurrentTranscript();
      if (!transcript || this.context.messages.length < 2) {
        throw new Error("No conversation to save");
      }

      const conversation = {
        title: `Dialogue with ${this.selectedPersona || 'AI Assistant'}`,
        participants: this.context.activePersonas || [],
        topic: this.context.topic || "Innovation and Creativity",
        transcript: transcript
      };

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversation)
      });

      if (!response.ok) {
        throw new Error('Failed to save conversation');
      }

      console.log("Conversation saved to knowledge base");
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }
}

export const conversationManager = new ConversationManager();
