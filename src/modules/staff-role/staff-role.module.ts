import { Module } from '@nestjs/common';
import { StaffRoleService } from './staff-role.service';
import { StaffRoleController } from './staff-role.controller';

@Module({
  controllers: [StaffRoleController],
  providers: [StaffRoleService],
  exports: [StaffRoleService],
})
export class StaffRoleModule {}
