import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateBusinessUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  parent_business_unit_id?: string | null;

  @IsOptional()
  @IsString()
  status?: string;
}
