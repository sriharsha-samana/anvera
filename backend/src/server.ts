import { app } from './app';
import { logger } from './infrastructure/logging/logger';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  logger.info('Backend server started', { port });
});
