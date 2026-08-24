import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreatePostRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsString()
  category?: string; // general, announcement, celebration
}

export class UpdatePostRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class PostResponseDto {
  id: string;
  organization_id: string;
  user_id: string;
  content: string;
  category: string;
  status: string;
  likes_count: number;
  comments_count: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

export class PostListResponseDto {
  id: string;
  organization_id: string;
  user_id: string;
  content: string;
  category: string;
  status: string;
  likes_count: number;
  comments_count: number;
  created_at: Date;
}
