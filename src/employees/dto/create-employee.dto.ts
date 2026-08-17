import { IsString, IsOptional, IsDateString, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  employee_code: string;

  @IsString()
  @MinLength(1)
  first_name: string;

  @IsString()
  @MinLength(1)
  last_name: string;

  @IsOptional()
  @IsString()
  work_email?: string;

  @IsOptional()
  @IsString()
  personal_email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsString()
  designation_id?: string;

  @IsOptional()
  @IsString()
  manager_id?: string;

  @IsDateString()
  date_of_joining: string;

  @IsOptional()
  @IsString()
  employment_type?: string;
}
