import { z } from 'zod';

const partSchema = z.object({
  type: z.string(),
}).passthrough();

const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['system', 'user', 'assistant']),
  parts: z.array(partSchema),
});

const userMessageSchema = messageSchema.extend({
  role: z.literal('user'),
});

export const postRequestBodySchema = z.object({
  id: z.string().min(1),
  message: userMessageSchema.optional(),
  messages: z.array(messageSchema).optional(),
}).refine((data) => Boolean(data.message) || Boolean(data.messages?.length), {
  message: 'Either message or messages must be provided.',
  path: ['message'],
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;