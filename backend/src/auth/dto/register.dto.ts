import type { RegisterInput } from '@tripcollab/shared';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsByteLength,
} from 'class-validator';

// Validates registration fields and trims email and username.
export class RegisterDto implements RegisterInput{
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  // Keeps the password unchanged, including whitespace.
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @IsByteLength(0, 72)
  password!: string;
}
