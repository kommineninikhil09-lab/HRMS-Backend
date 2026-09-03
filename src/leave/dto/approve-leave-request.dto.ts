import {
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ApproveLeaveRequestDto {
  @IsBoolean()
  approve!: boolean;

  /** Required when rejecting. */
  @ValidateIf((o: ApproveLeaveRequestDto) => o.approve === false)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  rejection_reason?: string;
}
