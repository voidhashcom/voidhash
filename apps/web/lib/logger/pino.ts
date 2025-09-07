import pino from 'pino';
import type { LogSchema } from '@/lib/logger/schema';
import type { Fields, Logger } from '@/lib/logger/types';
import { env } from '../env';

const pinoLogger = pino(
  { level: env.AXIOM_LOG_LEVEL },
  pino.transport({
    target: '@axiomhq/pino',
    options: {
      dataset: env.AXIOM_LOGS_DATASET,
      token: env.AXIOM_TOKEN
    }
  })
);

export class PinoLogger implements Logger {
  private requestId: string;
  private readonly environment: LogSchema['environment'];
  private readonly application: LogSchema['application'];
  private readonly defaultFields: Fields;

  constructor(opts: {
    requestId: string;
    environment: LogSchema['environment'];
    application: LogSchema['application'];
    defaultFields?: Fields;
  }) {
    this.requestId = opts.requestId;
    this.environment = opts.environment;
    this.application = opts.application;
    this.defaultFields = opts.defaultFields ?? {};
  }

  debug(message: string, fields?: Fields): void {
    pinoLogger.debug(
      {
        environment: this.environment,
        application: this.application,
        requestId: this.requestId,
        ...this.defaultFields,
        ...fields
      },
      message
    );
  }
  info(message: string, fields?: Fields): void {
    pinoLogger.info(
      {
        environment: this.environment,
        application: this.application,
        requestId: this.requestId,
        ...this.defaultFields,
        ...fields
      },
      message
    );
  }
  warn(message: string, fields?: Fields): void {
    pinoLogger.warn(
      {
        environment: this.environment,
        application: this.application,
        requestId: this.requestId,
        ...this.defaultFields,
        ...fields
      },
      message
    );
  }
  error(message: string, fields?: Fields): void {
    pinoLogger.error(
      {
        environment: this.environment,
        application: this.application,
        requestId: this.requestId,
        ...this.defaultFields,
        ...fields
      },
      message
    );
  }
  fatal(message: string, fields?: Fields): void {
    pinoLogger.fatal(
      {
        environment: this.environment,
        application: this.application,
        requestId: this.requestId,
        ...this.defaultFields,
        ...fields
      },
      message
    );
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }
}
