import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateLikeRequestDto {
  @IsString()
  @IsNotEmpty()
  likeable_type: string; // post, praise, comment

  @IsUUID()
  @IsNotEmpty()
  likeable_id: string;
}

export class LikeResponseDto {
  id: string;
  user_id: string;
  likeable_type: string;
  likeable_id: string;
  created_at: Date;
}

export class LikeListResponseDto {
  id: string;
  user_id: string;
  likeable_type: string;
  likeable_id: string;
  created_at: Date;
}
