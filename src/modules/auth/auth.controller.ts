import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'JWT token and user info returned' })
  async login(
    @Body() dto: LoginDto,
    @CurrentUser()
    user: {
      id: string;
      email: string;
      tenantId: string;
      tenantName: string;
      firstName: string;
      lastName: string;
      roles: string[];
      permissions: string[];
    },
  ) {
    return this.auth.issueTokenAndUser(user, dto.rememberMe);
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh-token')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Re-issue JWT with current user state from database' })
  @ApiOkResponse({ description: 'Fresh JWT token and updated user info' })
  async refreshToken(@CurrentUser('sub') userId: string) {
    return this.auth.refreshToken(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-tenants')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List all tenants the current user has access to' })
  @ApiOkResponse({ description: 'Array of tenants' })
  async getMyTenants(@CurrentUser('sub') userId: string) {
    return this.auth.getMyTenants(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-tenant')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Switch to another tenant and get a fresh JWT' })
  @ApiOkResponse({ description: 'Fresh JWT token and updated user info for target tenant' })
  async switchTenant(
    @CurrentUser('sub') userId: string,
    @Body('tenantId') tenantId: string,
  ) {
    return this.auth.switchTenant(userId, tenantId);
  }
}
