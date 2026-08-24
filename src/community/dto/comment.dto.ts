import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsUUID } from 'class-validator';

export class CreateCommentRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsString()
  @IsNotEmpty()
  commentable_type: string; // post, praise

  @IsUUID()
  @IsNotEmpty()
  commentable_id: string;
}

export class UpdateCommentRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;
}

export class CommentResponseDto {
  id: string;
  organization_id: string;
  user_id: string;
  content: string;
  commentable_type: string;
  commentable_id: string;
  status: string;
  likes_count: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export class CommentListResponseDto {
  id: string;
  user_id: string;
  content: string;
  commentable_type: string;
  commentable_id: string;
  likes_count: number;
  created_at: Date;
}
