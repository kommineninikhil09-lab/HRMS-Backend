import { IsString, IsNotEmpty, IsOptional, IsArray, MinLength, MaxLength, ArrayMinSize, ArrayMaxSize, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePollRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  question: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  notify_employees?: boolean;

  @IsOptional()
  is_anonymous?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires_at?: Date;
}

export class UpdatePollRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class VotePollRequestDto {
  @IsString()
  @IsNotEmpty()
  poll_option_id: string;
}

export class PollOptionResponseDto {
  id: string;
  poll_id: string;
  option_text: string;
  vote_count: number;
  order: number;
}

export class PollResponseDto {
  id: string;
  organization_id: string;
  user_id: string;
  question: string;
  description?: string;
  notify_employees: boolean;
  is_anonymous: boolean;
  total_votes: number;
  status: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  options?: PollOptionResponseDto[];
}

export class PollListResponseDto {
  id: string;
  organization_id: string;
  user_id: string;
  question: string;
  total_votes: number;
  status: string;
  expires_at?: Date;
  created_at: Date;
}
