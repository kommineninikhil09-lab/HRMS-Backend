import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  /** ISO date, e.g. "2026-10-29". */
  @IsDateString()
  holiday_date!: string;

  @IsOptional()
  @IsBoolean()
  is_optional?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
