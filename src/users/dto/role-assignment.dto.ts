import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Set (replace) a user's single primary role. */
export class AssignRoleDto {
  @IsUUID()
  roleId!: string;
}

export const SCOPE_TYPES = ['team', 'department'] as const;
export type ScopeTypeInput = (typeof SCOPE_TYPES)[number];

export class ManagerScopeDto {
  @IsIn(SCOPE_TYPES)
  scopeType!: ScopeTypeInput;

  @IsUUID()
  scopeId!: string;
}

/** Replace a user's entire management-scope set. */
export class ReplaceManagerScopesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ManagerScopeDto)
  scopes!: ManagerScopeDto[];
}
