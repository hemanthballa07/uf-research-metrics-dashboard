import type { Request, Response } from 'express';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import { findSimilarGrants, streamAnswer, ragEnabled } from '../services/aiService.js';

/** GET /api/grants/:id/similar?k= — cosine-nearest grants (empty if not embedded). */
export async function getSimilarGrantsHandler(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) throw new ValidationError('Invalid grant ID');
  const k = Math.min(Math.max(parseInt(String(req.query.k ?? '5'), 10) || 5, 1), 20);
  const items = await findSimilarGrants(id, k);
  res.status(200).json({ items });
}

/**
 * POST /api/ask { question } — retrieve-then-stream a Claude answer over SSE.
 * 503 when RAG keys are absent. Errors before the first byte → JSON; after → an SSE error event.
 */
export async function askHandler(req: Request, res: Response): Promise<void> {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) throw new ValidationError('A non-empty "question" is required');
  if (!ragEnabled()) {
    res.status(503).json({
      error: {
        message: 'RAG is not configured (set VOYAGE_API_KEY and ANTHROPIC_API_KEY)',
        code: 'RAG_UNAVAILABLE',
        statusCode: 503,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { grants } = await streamAnswer(question, (delta) => send('text', { delta }));
    send('sources', { grants });
    send('done', {});
  } catch (e) {
    send('error', { message: (e as Error).message });
  } finally {
    res.end();
  }
}
