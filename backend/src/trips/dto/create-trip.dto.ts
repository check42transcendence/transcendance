import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  IsOptional,
} from 'class-validator';
import type { CreateTripInput } from '@tripcollab/shared';

// Validates input for creating a trip.
export class CreateTripDto implements CreateTripInput {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  // Accepts valid calendar dates in YYYY-MM-DD format.
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  // Allows the description to be omitted or null.
  @IsOptional()
  @IsString()
  description?: string | null;
}
