import {
  Controller,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SmsService } from './sms.service';

@ApiTags('SMS')
@ApiBearerAuth('JWT')
@Controller('sms')
export class SmsController {
  constructor(private sms: SmsService) {}

  @Post('test/:provider')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('settings.manage')
  @ApiOperation({ summary: 'Test SMS provider connection (sinch or twilio)' })
  testProvider(@Param('provider') provider: string) {
    if (provider !== 'sinch' && provider !== 'twilio') {
      throw new BadRequestException('Provider must be "sinch" or "twilio"');
    }
    return this.sms.testProvider(provider);
  }
}
