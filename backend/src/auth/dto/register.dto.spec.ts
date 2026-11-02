import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

// Checks registration input validation and whitespace handling.
describe('RegisterDto', () => {
  // Trims email and username while preserving password whitespace.
  it('trims email and username without changing the password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: ' alice@example.com ',
      username: ' Alice ',
      password: ' my password ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('alice@example.com');
    expect(dto.username).toBe('Alice');
    expect(dto.password).toBe(' my password ');
  });

  // Rejects an email with an invalid format.
  it('rejects an invalid email', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'not-an-email',
      username: 'alice',
      password: 'example-password',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  // Rejects a username that becomes empty after trimming.
  it('rejects a username containing only whitespace', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      username: '   ',
      password: 'example-password',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'username')).toBe(true);
  });

  // Rejects input without a password.
  it('rejects a missing password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      username: 'alice',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  // Rejects passwords below the minimum character length.
  it('rejects a password shorter than 8 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      username: 'alice',
      password: '1234567',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  // Accepts a password at the minimum character length.
  it('accepts a password with exactly 8 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      username: 'alice',
      password: '12345678',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  // Accepts a Chinese password at the 72-byte limit.
  it('accepts a password with exactly 72 UTF-8 bytes', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      username: 'alice',
      password: '中'.repeat(24),
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  // Rejects a Chinese password exceeding the 72-byte limit.
  it('rejects a password exceeding 72 UTF-8 bytes', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      username: 'alice',
      password: '中'.repeat(24) + 'a',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
