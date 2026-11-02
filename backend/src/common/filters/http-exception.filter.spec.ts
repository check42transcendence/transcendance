import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

// Unit-test exception formatting without launching Postgres or a browser.
describe('HttpExceptionFilter', () => {
  const response = {};
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  function createFilter() {
    const reply = vi.fn();
    const adapterHost = {
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost;
    return { filter: new HttpExceptionFilter(adapterHost), reply };
  }

  const errorBody = (code: string, message: string) => ({
    error: { code, message, details: {} },
  });
  it('does not expose sensitive details from HTTP 500 exceptions', () => {
    const { filter, reply } = createFilter();

    filter.catch(
      new InternalServerErrorException({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database password=secret',
          details: { password: 'secret' },
        },
      }),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('INTERNAL_ERROR', 'Internal server error'),
      500,
    );
  });
  it('normalizes generic 403 to ACCESS_DENIED', () => {
    const { filter, reply } = createFilter();
    filter.catch(new ForbiddenException(), host);
    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('ACCESS_DENIED', 'Access denied'),
      403,
    );
  });

  it('preserves an unclassified 413 status', () => {
    const { filter, reply } = createFilter();

    filter.catch(new PayloadTooLargeException(), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('CLIENT_ERROR', 'Client request error'),
      413,
    );
  });

  it('preserves an unclassified 415 status', () => {
    const { filter, reply } = createFilter();

    filter.catch(new UnsupportedMediaTypeException(), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('CLIENT_ERROR', 'Client request error'),
      415,
    );
  });

  it('normalizes generic 404 to NOT_FOUND', () => {
    const { filter, reply } = createFilter();
    filter.catch(new NotFoundException(), host);
    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('NOT_FOUND', 'Not found'),
      404,
    );
  });

  it('keeps an intentional domain 403 and its details', () => {
    const { filter, reply } = createFilter();
    const body = {
      error: {
        code: 'TRIP_OWNER_REQUIRED',
        message: 'Trip owner required',
        details: { tripId: 'test-trip' },
      },
    };
    filter.catch(new ForbiddenException(body), host);
    expect(reply).toHaveBeenCalledWith(response, body, 403);
  });

  it('keeps a domain 404 for cross-Trip non-disclosure', () => {
    const { filter, reply } = createFilter();
    const body = errorBody('ACTIVITY_NOT_FOUND', 'Activity not found');
    filter.catch(new NotFoundException(body), host);
    expect(reply).toHaveBeenCalledWith(response, body, 404);
  });

  it('preserves an existing Auth 401 error', () => {
    const { filter, reply } = createFilter();
    const body = errorBody('INVALID_CREDENTIALS', 'Invalid email or password');
    filter.catch(new UnauthorizedException(body), host);
    expect(reply).toHaveBeenCalledWith(response, body, 401);
  });

  it('normalizes a generic 401 without changing its status', () => {
    const { filter, reply } = createFilter();
    filter.catch(new UnauthorizedException(), host);
    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('AUTHENTICATION_REQUIRED', 'Authentication required'),
      401,
    );
  });

  it('preserves DTO validation errors', () => {
    const { filter, reply } = createFilter();
    const body = errorBody('VALIDATION_ERROR', 'Invalid request input');
    filter.catch(new BadRequestException(body), host);
    expect(reply).toHaveBeenCalledWith(response, body, 400);
  });

  it('normalizes generic BadRequestException to VALIDATION_ERROR', () => {
    const { filter, reply } = createFilter();

    filter.catch(new BadRequestException('Invalid input'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('VALIDATION_ERROR', 'Invalid request input'),
      400,
    );
  });

  it('preserves business conflict codes', () => {
    const { filter, reply } = createFilter();
    const body = errorBody('EMAIL_ALREADY_EXISTS', 'Email already exists');
    filter.catch(new ConflictException(body), host);
    expect(reply).toHaveBeenCalledWith(response, body, 409);
  });

  it('hides unexpected internal exceptions', () => {
    const { filter, reply } = createFilter();
    filter.catch(new Error('Database connection password=secret'), host);
    expect(reply).toHaveBeenCalledWith(
      response,
      errorBody('INTERNAL_ERROR', 'Internal server error'),
      500,
    );
  });
});
