import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Self-service profile fields an authenticated user may change on themselves. */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;
}
