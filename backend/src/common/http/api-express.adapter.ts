import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';

// Preserve known Express body-parser errors before Nest normalizes them.
export class ApiExpressAdapter extends ExpressAdapter {
  override mapException(error: unknown): unknown {
    if (
      error instanceof SyntaxError &&
      'status' in error &&
      error.status === 400 &&
      'type' in error &&
      error.type === 'entity.parse.failed'
    ) {
      return new BadRequestException({
        error: {
          code: 'MALFORMED_REQUEST',
          message: 'Malformed request',
          details: {},
        },
      });
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 413 &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      return new PayloadTooLargeException({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body too large',
          details: {},
        },
      });
    }

    return super.mapException(error);
  }
}
