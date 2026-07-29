export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ThreadTurn {
  user: string;
  assistant: string;
}

export class ThreadManager {
  private turns: ThreadTurn[] = [];

  getTurns(): ThreadTurn[] {
    return [...this.turns];
  }

  addTurn(user: string, assistant: string): void {
    this.turns.push({ user, assistant });
  }

  clear(): void {
    this.turns = [];
  }

  buildMessages(systemPrompt: string, currentUserText: string): ChatMessage[] {
    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    for (const turn of this.turns) {
      messages.push({ role: "user", content: turn.user });
      messages.push({ role: "assistant", content: turn.assistant });
    }

    const formattedUserText = currentUserText.trim().endsWith("__") ? currentUserText.trim() : `${currentUserText.trim()} __`;

    messages.push({ role: "user", content: formattedUserText });

    return messages;
  }
}
