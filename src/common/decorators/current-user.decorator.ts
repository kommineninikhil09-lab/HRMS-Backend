import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface ICurrentUser {
  sub: string; // user ID
  organizationId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as ICurrentUser | undefined;
  },
);
