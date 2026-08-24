import { IsString, IsNotEmpty, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class CreatePraiseRequestDto {
  @IsUUID()
  @IsNotEmpty()
  to_employee_id: string;

  @IsString()
  @IsNotEmpty()
  badge_type: string; // top_performer, leadership_impact, customer_hero, above_beyond, team_player, rockstar_rookie, legacy_builder, all_day_everyday

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsString()
  visibility?: string; // public, team, private
}

export class UpdatePraiseRequestDto {
  @IsOptional()
  @IsString()
  badge_type?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsString()
  visibility?: string;
}

export class PraiseResponseDto {
  id: string;
  organization_id: string;
  from_user_id: string;
  to_employee_id: string;
  badge_type: string;
  description: string;
  project_id?: string;
  visibility: string;
  likes_count: number;
  comments_count: number;
  created_at: Date;
  updated_at: Date;
}

export class PraiseListResponseDto {
  id: string;
  from_user_id: string;
  to_employee_id: string;
  badge_type: string;
  description: string;
  visibility: string;
  likes_count: number;
  comments_count: number;
  created_at: Date;
}
