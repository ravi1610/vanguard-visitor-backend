import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

const TASK_SORT_FIELDS = ['title', 'status', 'dueDate', 'createdAt'] as const;

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: PagedQueryDto, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (status) {
      const statuses = status.split(',');
      where.status =
        statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField &&
      TASK_SORT_FIELDS.includes(
        query.sortField as (typeof TASK_SORT_FIELDS)[number],
      )
        ? query.sortField
        : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: {
          project: { select: { id: true, name: true } },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ]);
    return { rows, total };
  }
}
