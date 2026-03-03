import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { router } from './interface/http/routes';
import { errorHandler } from './interface/http/middleware/errorHandler';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(router);
app.use(errorHandler);
