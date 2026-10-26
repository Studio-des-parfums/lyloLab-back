import {
  ForbiddenException,
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

export type TeamRole = 'admin' | 'member';

/** The signed-in user, attached to the request by AuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  teamId: string;
}

export const IS_PUBLIC_KEY = 'isPublic';

/** Opens a route to signed-out visitors (login, sign-up). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<{ user: AuthUser }>().user,
);

export function assertAdmin(user: AuthUser): void {
  if (user.role !== 'admin') {
    throw new ForbiddenException("Seul un administrateur de l'équipe peut faire cela.");
  }
}
