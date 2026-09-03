import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const HALF_DAY_OPTIONS = [
  'full_day',
  'first_half',
  'second_half',
] as const;
export type HalfDayOption = (typeof HALF_DAY_OPTIONS)[number];

export class CreateLeaveRequestDto {
  @IsUUID()
  leave_type_id!: string;

  /** ISO date, e.g. "2026-09-15". */
  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  /**
   * Whole day (default) or one half of a single day. `first_half` / `second_half`
   * are only valid when `start_date` === `end_date`.
   */
  @IsOptional()
  @IsIn(HALF_DAY_OPTIONS)
  half_day_option?: HalfDayOption;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /** Extra users to notify about this request (delivery is F11). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  notify_user_ids?: string[];
}
