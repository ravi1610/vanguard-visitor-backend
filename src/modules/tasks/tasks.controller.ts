import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Tasks')
@ApiBearerAuth('JWT')
@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('projects.view')
  @ApiOperation({ summary: 'List all tasks across projects with pagination' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (comma-separated, e.g. todo,in_progress)',
  })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.tasks.findAll(tenantId, query, status);
  }
}
