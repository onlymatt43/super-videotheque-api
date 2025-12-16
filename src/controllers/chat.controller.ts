import type { Request, Response } from 'express';
import { chatService } from '../services/chat.service.js';

interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const chat = async (req: Request<{}, {}, ChatRequest>, res: Response) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const response = await chatService.chat(message, history);
    res.json({ data: { response } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Chat error';
    res.status(500).json({ error: errorMessage });
  }
};
