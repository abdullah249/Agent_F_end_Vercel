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
  private selectedPersonas: string[] = [];
  private isSpeaking: boolean = false;
  private isMultiPersonaMode: boolean = false;
  private responseQueue: { text: string, persona: string }[] = [];
  private isProcessingQueue: boolean = false;

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

  // Method to set the selected persona for single-persona mode
  setSelectedPersona(persona: string): void {
    this.isMultiPersonaMode = false;
    this.selectedPersona = persona;
    this.selectedPersonas = [persona];
    this.context.activePersonas = [persona];
    console.log(`Selected persona: ${persona}`);

    // Reset conversation if it was already initialized
    if (this.isInitialized) {
      this.isInitialized = false;
      this.context.messages = [];
      this.context.turnCount = 0;
    }
  }

  // Method to set multiple personas for multi-persona mode
  setSelectedPersonas(personas: string[]): void {
    if (personas.length < 2) {
      console.error('At least 2 personas must be selected for multi-persona mode');
      return;
    }

    this.isMultiPersonaMode = true;
    this.selectedPersona = null;
    this.selectedPersonas = [...personas];
    this.context.activePersonas = [...personas];
    console.log(`Selected personas: ${personas.join(', ')}`);

    // Reset conversation if it was already initialized
    if (this.isInitialized) {
      this.isInitialized = false;
      this.context.messages = [];
      this.context.turnCount = 0;
    }
  }

  // Toggle between single and multi-persona modes
  setMultiPersonaMode(enabled: boolean): void {
    this.isMultiPersonaMode = enabled;
    console.log(`Multi-persona mode: ${enabled ? 'enabled' : 'disabled'}`);

    // Reset conversation if it was already initialized
    if (this.isInitialized) {
      this.isInitialized = false;
      this.context.messages = [];
      this.context.turnCount = 0;
    }
  }

  // Get the currently selected persona(s)
  getSelectedPersonas(): string[] {
    return this.selectedPersonas;
  }

  // Check if in multi-persona mode
  isInMultiPersonaMode(): boolean {
    return this.isMultiPersonaMode;
  }

  async startConversation(): Promise<void> {
    if (this.isInitialized) {
      console.log('Conversation already initialized');
      return;
    }

    // Check if personas are selected
    if (this.selectedPersonas.length === 0) {
      console.error('No personas selected');
      throw new Error('Please select at least one persona before starting a conversation');
    }

    try {
      console.log(`Initializing conversation with ${this.selectedPersonas.join(', ')}`);

      let systemMessage: Message;

      if (this.isMultiPersonaMode) {
        // Create a system message for a conversation between multiple personas
        systemMessage = {
          role: "system",
          content: this.createMultiPersonaSystemPrompt()
        };
      } else {
        // Create a system message for a conversation with a single persona
        systemMessage = {
          role: "system",
          content: `You are ${this.selectedPersonas[0]}, having a one-on-one conversation with the user about innovation, creativity, and design thinking.
          Respond as ${this.selectedPersonas[0]} would, with their unique perspective, knowledge, and personality.
          
          Keep your responses concise (1-3 sentences) to maintain a natural conversational flow.
          
          ${this.getPersonaInstructions(this.selectedPersonas[0])}`
        };
      }

      this.context.messages = [systemMessage];
      this.context.topic = "innovation, creativity, and design thinking";
      this.isInitialized = true;

      // Initialize audio system before starting conversation
      try {
        await voiceService.initAudio();
      } catch (error) {
        console.warn('Failed to initialize audio, continuing without audio initialization:', error);
      }

      // If in multi-persona mode, automatically start the conversation
      if (this.isMultiPersonaMode && this.selectedPersonas.length >= 2) {
        console.log('Auto-starting multi-persona conversation');
        const initialPrompt = "Let's have an interesting discussion about innovation, creativity, and the future of technology.";
        await this.handleUserInput(initialPrompt);
      }
      // Otherwise, wait for user input in single-persona mode
    } catch (error) {
      console.error('Failed to start conversation:', error);
      this.isInitialized = false;
      console.log('Conversation initialization failed, but application will continue');
    }
  }

  // Create a system prompt for multi-persona conversation
  private createMultiPersonaSystemPrompt(): string {
    const personasList = this.selectedPersonas.join(', ');
    const personaInstructions = this.selectedPersonas.map(p => this.getPersonaInstructions(p)).join('\n\n');

    return `You are facilitating a conversation between ${personasList} about innovation, creativity, and design thinking.
    
    For each response, you should:
    1. Choose ONE persona to speak next
    2. Format your response as: "PERSONA_NAME: [their response]"
    3. Make sure each persona speaks in their authentic voice and perspective
    4. Allow each persona to fully express their thoughts and ideas
    5. Ensure a natural back-and-forth between the personas
    
    The user will provide topics or questions to guide the conversation.
    
    Persona instructions:
    ${personaInstructions}`;
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

      case "Emad Mostaque":
        return `As Emad Mostaque:
        - Discuss the transformative potential of AI
        - Reference your work with Stability AI and diffusion models
        - Emphasize democratizing access to powerful technologies
        - Share your vision for how AI will reshape society and creativity`;

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
                max_tokens: this.isMultiPersonaMode ? 2000 : 120, // Significantly increased token limit for multi-persona mode
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
                  max_tokens: this.isMultiPersonaMode ? 2000 : 120, // Significantly increased token limit for multi-persona mode
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
              max_tokens: this.isMultiPersonaMode ? 2000 : 120, // Significantly increased token limit for multi-persona mode
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

        if (this.isMultiPersonaMode) {
          // Process multi-persona response
          await this.processMultiPersonaResponse(aiResponse);
        } else {
          // Process single-persona response
          const currentSpeaker = this.selectedPersonas[0] || "Assistant";
          console.log('Speaking as:', currentSpeaker);

          this.context.messages.push({
            role: "assistant",
            content: aiResponse,
            persona: currentSpeaker
          });

          this.context.lastResponse = aiResponse;
          this.isSpeaking = true;

          try {
            await this.speak(aiResponse, currentSpeaker);
          } catch (speakError) {
            console.error('Error in speech synthesis, continuing without speech:', speakError);
          } finally {
            this.isSpeaking = false;
          }
        }
      } catch (aiError: any) {
        console.error('Error getting AI response:', aiError);

        // Create a fallback response
        const fallbackResponse = "I'm having trouble connecting to the AI service. Let's continue our conversation. What would you like to discuss?";
        const fallbackSpeaker = this.selectedPersonas[0] || "Assistant";

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
        this.isSpeaking = false;
      }
      console.log('Conversation error handled, application will continue');
    }
  }

  // Process a multi-persona response by parsing it and adding to the queue
  private async processMultiPersonaResponse(response: string): Promise<void> {
    console.log('Processing multi-persona response:', response);
    
    // Clear the existing queue
    this.responseQueue = [];
    
    // Parse the response to extract persona-specific responses
    const lines = response.split('\n');
    let currentPersona: string | null = null;
    let currentText = '';
    
    for (const line of lines) {
      // Check if this line starts a new persona's response
      const personaMatch = line.match(/^([A-Za-z\s\.]+):/);
      
      if (personaMatch) {
        // If we were already building a response, add it to the queue
        if (currentPersona && currentText.trim()) {
          this.responseQueue.push({
            persona: currentPersona,
            text: currentText.trim()
          });
        }
        
        // Start a new response
        currentPersona = this.findMatchingPersona(personaMatch[1].trim());
        currentText = line.substring(personaMatch[0].length).trim();
      } else if (currentPersona) {
        // Continue building the current response
        currentText += ' ' + line.trim();
      }
    }
    
    // Add the final response to the queue
    if (currentPersona && currentText.trim()) {
      this.responseQueue.push({
        persona: currentPersona,
        text: currentText.trim()
      });
    }
    
    // If no valid responses were parsed, create a fallback
    if (this.responseQueue.length === 0) {
      console.warn('Failed to parse multi-persona response, using fallback');
      
      // Use the first selected persona as fallback
      const fallbackPersona = this.selectedPersonas[0];
      this.responseQueue.push({
        persona: fallbackPersona,
        text: response
      });
    }
    
    // Add all responses to the conversation context
    const fullResponse = this.responseQueue.map(r => `${r.persona}: ${r.text}`).join('\n\n');
    this.context.messages.push({
      role: "assistant",
      content: fullResponse
    });
    
    this.context.lastResponse = fullResponse;
    
    // Process the queue
    await this.processResponseQueue();
  }
  
  // Find the matching persona name from the available personas
  private findMatchingPersona(name: string): string {
    // Try to find an exact match
    const exactMatch = this.selectedPersonas.find(p => 
      p.toLowerCase() === name.toLowerCase()
    );
    
    if (exactMatch) return exactMatch;
    
    // Try to find a partial match
    const partialMatch = this.selectedPersonas.find(p => 
      name.toLowerCase().includes(p.toLowerCase()) || 
      p.toLowerCase().includes(name.toLowerCase())
    );
    
    if (partialMatch) return partialMatch;
    
    // If no match found, return the name as is
    return name;
  }
  
  // Process the response queue sequentially
  private async processResponseQueue(): Promise<void> {
    if (this.isProcessingQueue || this.responseQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    this.isSpeaking = true;
    
    try {
      for (const response of this.responseQueue) {
        console.log(`Speaking as ${response.persona}: "${response.text.substring(0, 30)}..."`);
        
        try {
          await this.speak(response.text, response.persona);
          // Add a small pause between speakers
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error speaking as ${response.persona}:`, error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
      this.isSpeaking = false;
      this.responseQueue = [];
    }
  }

  private async speak(text: string, persona?: string): Promise<void> {
    if (!text.trim()) return;

    try {
      console.log(`Attempting to speak as ${persona || 'default'}: "${text.substring(0, 30)}..."`);

      // No timeout - let the speech synthesis run until completion
      await voiceService.synthesizeSpeech({
        text,
        persona
      });
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

      const participants = this.isMultiPersonaMode 
        ? this.selectedPersonas 
        : [this.selectedPersonas[0] || 'AI Assistant'];

      const title = this.isMultiPersonaMode
        ? `Dialogue between ${participants.join(', ')}`
        : `Dialogue with ${participants[0]}`;

      const conversation = {
        title,
        participants,
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
