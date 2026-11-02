import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
  // Rejects passwords below the minimum character length.
  it('rejects a password shorter than 8 characters', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: '1234567',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  // Accepts a password at the minimum character length.
  it('accepts a password with exactly 8 characters', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: '12345678',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  // Accepts a Chinese password at the 72-byte limit.
  it('accepts a password with exactly 72 UTF-8 bytes', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: '中'.repeat(24),
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  // Rejects a Chinese password exceeding the 72-byte limit.
  it('rejects a password exceeding 72 UTF-8 bytes', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: '中'.repeat(24) + 'a',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
