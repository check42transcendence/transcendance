import type { LoginInput } from '@tripcollab/shared';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsByteLength,
} from 'class-validator';

// Validates login input; only the email is trimmed.
export class LoginDto implements LoginInput{
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @IsByteLength(0, 72)
  password!: string;
}
