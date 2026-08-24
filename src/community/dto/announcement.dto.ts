import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnnouncementRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsString()
  priority?: string; // low, medium, high, urgent

  @IsOptional()
  @IsString()
  status?: string; // published, scheduled, draft, archived

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  published_at?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires_at?: Date;
}

export class UpdateAnnouncementRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  published_at?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires_at?: Date;
}

export class PublishAnnouncementRequestDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publish_at?: Date;
}

export class AnnouncementResponseDto {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  title: string;
  content: string;
  priority: string;
  status: string;
  published_at?: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class AnnouncementListResponseDto {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  title: string;
  priority: string;
  status: string;
  published_at?: Date;
  expires_at?: Date;
  created_at: Date;
}
