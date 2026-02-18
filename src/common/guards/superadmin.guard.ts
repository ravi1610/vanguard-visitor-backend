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
    if (!payload?.isSuperAdmin) {
      throw new ForbiddenException('Superadmin access required');
    }
    return true;
  }
}
