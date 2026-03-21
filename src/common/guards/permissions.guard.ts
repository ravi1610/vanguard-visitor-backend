import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  private pickActionFromRequest(method: string, path: string): string {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('/import')) return 'import';
    if (lowerPath.includes('/export')) return 'export';
    if (method === 'POST') return 'create';
    if (method === 'PATCH' || method === 'PUT') return 'update';
    if (method === 'DELETE') return 'delete';
    return 'read';
  }

  private hasPermission(
    granted: Set<string>,
    required: string,
    method: string,
    path: string,
  ): boolean {
    const reqAction = this.pickActionFromRequest(method, path);

    if (granted.has(required)) return true;

    const [moduleKey, action] = required.split('.');
    if (!moduleKey || !action) return false;

    if (action === 'view') {
      if (reqAction === 'export') {
        return granted.has(`${moduleKey}.export`);
      }
      if (reqAction === 'import') {
        return granted.has(`${moduleKey}.import`);
      }
      return granted.has(`${moduleKey}.read`);
    }

    if (action === 'manage') {
      return granted.has(`${moduleKey}.${reqAction}`) || granted.has(`${moduleKey}.manage`);
    }

    if (required === 'visit.checkin') {
      return granted.has('visit.create') || granted.has('visit.update');
    }

    if (required === 'visit.checkout') {
      return granted.has('visit.update');
    }

    if (required === 'visit.view_history') {
      return granted.has('visit.read');
    }

    return false;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    const payload = user as JwtPayload;
    const req = context.switchToHttp().getRequest();
    const method = String(req?.method ?? 'GET').toUpperCase();
    const path = String(req?.route?.path ?? req?.url ?? '');
    const granted = new Set(payload?.permissions ?? []);

    // Superadmins bypass all permission checks
    if (payload?.isSuperAdmin) return true;

    const hasAny = requiredPermissions.some((perm) =>
      this.hasPermission(granted, perm, method, path),
    );
    if (!hasAny) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
