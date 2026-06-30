import { registerAs } from '@nestjs/config';
import { parseCsvEnv } from './parse-csv-env';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
] as const;

export default registerAs('app', () => ({
  port: Number.parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: parseCsvEnv(
    process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL,
    DEFAULT_CORS_ORIGINS,
  ),
}));
