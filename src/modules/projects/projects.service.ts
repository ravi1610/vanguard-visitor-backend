import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const PROJECT_SORT_FIELDS = ['name', 'status', 'createdAt'] as const;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async createProject(tenantId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'active',
      },
    });
  }

  async findAllProjects(tenantId: string, query: PagedQueryDto, status?: string) {
    const where: {
      tenantId: string;
      status?: 'active' | 'completed' | 'on_hold';
      OR?: object[];
    } = { tenantId };
    if (status) where.status = status as 'active' | 'completed' | 'on_hold';
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && PROJECT_SORT_FIELDS.includes(query.sortField as (typeof PROJECT_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: { _count: { select: { tasks: true } } },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { rows, total };
  }

  async findOneProject(tenantId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
      include: {
        tasks: {
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async updateProject(tenantId: string, id: string, dto: UpdateProjectDto) {
    await this.findOneProject(tenantId, id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async removeProject(tenantId: string, id: string) {
    await this.findOneProject(tenantId, id);
    return this.prisma.project.delete({ where: { id } });
  }

  async createTask(tenantId: string, projectId: string, dto: CreateTaskDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.task.create({
      data: {
        tenantId,
        projectId,
        title: dto.title,
        status: dto.status ?? 'todo',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedToUserId: dto.assignedToUserId,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findAllTasks(tenantId: string, projectId: string) {
    return this.prisma.task.findMany({
      where: { tenantId, projectId },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async findOneTask(tenantId: string, projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, tenantId },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateTask(
    tenantId: string,
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.findOneTask(tenantId, projectId, taskId);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title != null && { title: dto.title }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.assignedToUserId !== undefined && {
          assignedToUserId: dto.assignedToUserId,
        }),
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async removeTask(tenantId: string, projectId: string, taskId: string) {
    await this.findOneTask(tenantId, projectId, taskId);
    return this.prisma.task.delete({ where: { id: taskId } });
  }
}
