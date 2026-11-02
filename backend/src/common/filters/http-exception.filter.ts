import type { ApiErrorResponse } from '@tripcollab/shared'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

function makeError(
	code: string, 
	message: string
): ApiErrorResponse {
	return { 
		error: { 
			code, 
			message, 
			details: {} 
		} 
	};
}

// A deliberate domain/Auth error already has the frozen REST shape.
function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;

  const fields = error as Record<string, unknown>;
  return (
    typeof fields.code === 'string' &&
    typeof fields.message === 'string' &&
    typeof fields.details === 'object' &&
    fields.details !== null &&
    !Array.isArray(fields.details)
  );
}

// Express's JSON parser can throw before a controller or DTO runs.
function isMalformedJson(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false;
  const error = exception as { status?: unknown; type?: unknown };
  return error.status === 400 && error.type === 'entity.parse.failed';
}

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    @Inject(HttpAdapterHost)
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const response = host.switchToHttp().getResponse();

    if (isMalformedJson(exception)) {
      httpAdapter.reply(
        response,
        makeError('MALFORMED_REQUEST', 'Malformed request'),
        HttpStatus.BAD_REQUEST,
      );
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      // Never expose the body of a server-side exception.
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.replyInternalError(response);
        return;
      }

      const original: unknown = exception.getResponse();
      // Never rewrite intentional feature or Auth machine codes.
      if (isApiErrorResponse(original)) {
        httpAdapter.reply(response, original, status);
        return;
      }
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          httpAdapter.reply(
            response,
            makeError('VALIDATION_ERROR', 'Invalid request input'),
            status,
          );
          return;
        case HttpStatus.UNAUTHORIZED:
          httpAdapter.reply(
            response,
            makeError('AUTHENTICATION_REQUIRED', 'Authentication required'),
            status,
          );
          return;
        case HttpStatus.FORBIDDEN:
          httpAdapter.reply(
            response,
            makeError('ACCESS_DENIED', 'Access denied'),
            status,
          );
          return;
        case HttpStatus.NOT_FOUND:
          httpAdapter.reply(
            response,
            makeError('NOT_FOUND', 'Not found'),
            status,
          );
          return;
        case HttpStatus.CONFLICT:
          httpAdapter.reply(
            response,
            makeError('STATE_CONFLICT', 'State conflict'),
            status,
          );
          return;

        default:
          // Preserve recognized client-error status codes.
          // Never expose raw framework error messages.
          if (status >= 400 && status < 500) {
            httpAdapter.reply(
              response,
              makeError('CLIENT_ERROR', 'Client request error'),
              status,
            );
            return;
          }

          this.replyInternalError(response);
          return;
      }
    }

    this.replyInternalError(response);
  }

  private replyInternalError(response: unknown): void {
    // Do not log raw exceptions that may contain sensitive data.
    this.logger.error('Unhandled HTTP exception');

    this.adapterHost.httpAdapter.reply(
      response,
      makeError('INTERNAL_ERROR', 'Internal server error'),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
