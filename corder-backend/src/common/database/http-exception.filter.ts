import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface DatabaseDriverError {
  code?: string;
  type?: string;
  message?: string;
  stack?: string;
}

export function mapUnhandledErrorToHttp(exception: unknown): {
  status: number;
  body: Record<string, unknown>;
  shouldLogStack: boolean;
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const rawResponse = exception.getResponse();
    const body =
      typeof rawResponse === 'string'
        ? { statusCode: status, message: rawResponse }
        : (rawResponse as Record<string, unknown>);
    return {
      status,
      body,
      shouldLogStack: status >= HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  const dbErr = (exception ?? {}) as DatabaseDriverError;
  if (dbErr.type === 'entity.too.large') {
    return {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      body: {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'Request payload is too large',
        error: 'Payload Too Large',
      },
      shouldLogStack: false,
    };
  }

  if (dbErr.code === '23505') {
    return {
      status: HttpStatus.CONFLICT,
      body: {
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with the same unique value already exists',
        error: 'Conflict',
      },
      shouldLogStack: false,
    };
  }

  if (dbErr.code === '23503') {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Referenced record does not exist or is still in use',
        error: 'Bad Request',
      },
      shouldLogStack: false,
    };
  }

  if (dbErr.code === '22P02') {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid identifier or parameter format',
        error: 'Bad Request',
      },
      shouldLogStack: false,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    },
    shouldLogStack: true,
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      return;
    }

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, body, shouldLogStack } = mapUnhandledErrorToHttp(exception);

    if (shouldLogStack) {
      const err = exception as Error | undefined;
      this.logger.error(
        `[${req?.method ?? 'HTTP'} ${req?.originalUrl ?? req?.url ?? ''}] ${err?.message ?? 'Unhandled exception'}`,
        err?.stack,
      );
    }

    if (!res.headersSent) {
      res.status(status).json(body);
    }
  }
}
