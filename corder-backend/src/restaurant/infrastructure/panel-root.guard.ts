import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Panel root admin only (JWT `role === 'root'`). */
@Injectable()
export class PanelRootGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    if (req.user?.role !== 'root') {
      throw new ForbiddenException('Bu islem icin yonetici yetkisi gerekir');
    }
    return true;
  }
}
