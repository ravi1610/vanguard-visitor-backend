import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Roles')
@ApiBearerAuth('JWT')
@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private rbac: RbacService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles for current tenant' })
  getRoles(@CurrentUser('tenantId') tenantId: string) {
    return this.rbac.getRolesForTenant(tenantId);
  }
}
