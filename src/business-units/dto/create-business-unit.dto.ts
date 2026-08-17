import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateBusinessUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @IsOptional()
  @IsString()
  parent_business_unit_id?: string;
}
