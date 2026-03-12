import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const PROJECT_STATUSES = ['active', 'on_hold', 'completed'] as const;
const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;

export async function seedProjectsAndTasks(
  prisma: PrismaClient,
  ctx: DummySeedContext,
): Promise<void> {
  const { tenantId, adminUserId, counts } = ctx;
  const projectsCount = counts.projects;
  const tasksCount = counts.tasks;

  const projectsData = Array.from({ length: projectsCount }, (_, i) => ({
    id: `seed-project-${i + 1}`,
    tenantId,
    name: `Project ${i + 1}`,
    description: `Dummy project description ${i + 1}`,
    status: at(i, PROJECT_STATUSES),
  }));

  await createManyBatched((chunk) => prisma.project.createMany({ data: chunk, skipDuplicates: true }), projectsData);

  const projectIds = projectsData.map((p) => p.id);
  const tasksData = Array.from({ length: tasksCount }, (_, i) => ({
    id: `seed-task-${i + 1}`,
    tenantId,
    projectId: at(i, projectIds),
    title: `Task ${i + 1}`,
    status: at(i, TASK_STATUSES),
    dueDate: dateOffset((i - tasksCount) * 86400000),
    assignedToUserId: i % 5 === 0 ? adminUserId : null,
  }));

  await createManyBatched((chunk) => prisma.task.createMany({ data: chunk, skipDuplicates: true }), tasksData);

  console.log(`  ${projectsCount} projects, ${tasksCount} tasks`);
}
