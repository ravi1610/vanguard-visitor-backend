import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    const payload = user as JwtPayload;
    const hasAdminRole = Array.isArray(payload?.roles)
      ? payload.roles.some((r) => String(r).trim().toLowerCase() === 'admin')
      : false;

    if (!payload?.isSuperAdmin && !hasAdminRole) {
      throw new ForbiddenException('Superadmin access required');
    }
    return true;
  }
}
