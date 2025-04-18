
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
  private stopRequested: boolean = false;

  constructor() {
    const OPENAI_API_KEY="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";
    const apiKey = OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key is required');
    }


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

  // Check if currently speaking
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
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

      // Wait for user input in both single and multi-persona modes
      console.log('Conversation initialized, waiting for user input');
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
    
    For each response, you MUST:
    1. Choose ONE persona to speak next
    2. Format your response as: "PERSONA_NAME: [their response]"
    3. Make sure each persona speaks in their authentic voice and perspective
    4. Ensure a natural back-and-forth between the personas
    5. ALWAYS generate EXACTLY 15-20 exchanges between personas (6-10 personas speaking, one after the other)
       This is CRITICAL - you MUST include at least 15 exchanges, with different personas taking turns.
    
    IMPORTANT: This is a real-time conversation. The first persona's response should be concise (3-4 sentences) 
    to start speaking quickly, but subsequent responses can be more detailed.
    
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

        // Set speaking state early to show the stop button immediately
        this.isSpeaking = true;

        
        // Use a higher token limit for longer conversations while maintaining immediate response
        const model = "gpt-3.5-turbo";
        const maxTokens = this.isMultiPersonaMode ? 3000 : 300;

        console.log(`Using ${model} model directly with max_tokens=${maxTokens}`);
        const response = await this.openai.chat.completions.create({
          model: model,
          messages: this.context.messages,
          temperature: 0.7,
          max_tokens: maxTokens, // Increased for longer conversations
          presence_penalty: 0.5,
          frequency_penalty: 0.5
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response received from AI");
        }

        const aiResponse = content;

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

    // Set speaking state early to show the stop button immediately
    this.isSpeaking = true;

    // Clear the existing queue
    this.responseQueue = [];

    // Parse the response to extract persona-specific responses
    const lines = response.split('\n');
    let currentPersona: string | null = null;
    let currentText = '';
    let firstPersonaResponse = null;

    for (const line of lines) {
      // Check if this line starts a new persona's response
      const personaMatch = line.match(/^([A-Za-z\s\.]+):/);

      if (personaMatch) {
        // If we were already building a response, add it to the queue
        if (currentPersona && currentText.trim()) {
          const responseItem = {
            persona: currentPersona,
            text: currentText.trim()
          };
          
          this.responseQueue.push(responseItem);
          
          // Save the first persona response to start speaking immediately
          if (firstPersonaResponse === null) {
            firstPersonaResponse = responseItem;
          }
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
      const responseItem = {
        persona: currentPersona,
        text: currentText.trim()
      };
      
      this.responseQueue.push(responseItem);
      
      // Save the first persona response if this is the only one
      if (firstPersonaResponse === null) {
        firstPersonaResponse = responseItem;
      }
    }

    // If no valid responses were parsed, create a fallback
    if (this.responseQueue.length === 0) {
      console.warn('Failed to parse multi-persona response, using fallback');

      // Use the first selected persona as fallback
      const fallbackPersona = this.selectedPersonas[0];
      const responseItem = {
        persona: fallbackPersona,
        text: response
      };
      
      this.responseQueue.push(responseItem);
      firstPersonaResponse = responseItem;
    }

    // Add all responses to the conversation context immediately
    const fullResponse = this.responseQueue.map(r => `${r.persona}: ${r.text}`).join('\n\n');
    this.context.messages.push({
      role: "assistant",
      content: fullResponse
    });

    this.context.lastResponse = fullResponse;

    // Start speaking the first persona's response immediately
    if (firstPersonaResponse) {
      console.log(`Speaking immediately as ${firstPersonaResponse.persona}: "${firstPersonaResponse.text.substring(0, 30)}..."`);
      
      // Remove the first response from the queue since we're handling it separately
      this.responseQueue.shift();
      
      // Start speaking the first response immediately
      this.speak(firstPersonaResponse.text, firstPersonaResponse.persona)
        .then(() => {
          // Only continue with the queue if not stopped
          if (!this.stopRequested) {
            this.processResponseQueue();
          }
        })
        .catch(error => {
          console.error(`Error speaking as ${firstPersonaResponse?.persona}:`, error);
          // Continue with the queue even if there was an error
          if (!this.stopRequested) {
            this.processResponseQueue();
          }
        });
    } else {
      // If no first response (shouldn't happen), just process the queue
      this.processResponseQueue();
    }

    // Return immediately to make the UI responsive
    return Promise.resolve();
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
    this.stopRequested = false;

    try {
      for (const response of this.responseQueue) {
        // Check if stop was requested
        if (this.stopRequested) {
          console.log('Conversation stop requested, stopping queue processing');
          break;
        }

        console.log(`Speaking as ${response.persona}: "${response.text.substring(0, 30)}..."`);

        try {
          await this.speak(response.text, response.persona);
          // Reduced pause between speakers for more natural conversation flow
        //  await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 500ms to 50ms
        } catch (error) {
          console.error(`Error speaking as ${response.persona}:`, error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
      this.isSpeaking = false;
      this.responseQueue = [];
      this.stopRequested = false;
    }
  }

  /**
   * Stops the current conversation
   * This can be called at any time to interrupt ongoing speech
   */
  stopConversation(): void {
    console.log('Stopping conversation');

    // Set the stop flag
    this.stopRequested = true;

    // Stop any ongoing speech
    voiceService.stopSpeaking();

    // Clear the queue
    this.responseQueue = [];

    // Reset all states
    this.isSpeaking = false;
    this.isProcessingQueue = false;
    this.isInitialized = false; // Reset initialization state to allow starting a new conversation

    // Reset conversation context
    this.context.messages = this.context.messages.slice(0, 1); // Keep only the system message
    this.context.turnCount = 0;
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
