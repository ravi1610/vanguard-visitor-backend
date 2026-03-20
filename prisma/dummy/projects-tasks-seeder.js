"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedProjectsAndTasks = seedProjectsAndTasks;
const helpers_1 = require("./helpers");
const PROJECT_STATUSES = ['active', 'on_hold', 'completed'];
const TASK_STATUSES = ['todo', 'in_progress', 'done'];
async function seedProjectsAndTasks(prisma, ctx) {
    const { tenantId, adminUserId, counts } = ctx;
    const projectsCount = counts.projects;
    const tasksCount = counts.tasks;
    const projectsData = Array.from({ length: projectsCount }, (_, i) => ({
        id: `seed-project-${i + 1}`,
        tenantId,
        name: `Project ${i + 1}`,
        description: `Dummy project description ${i + 1}`,
        status: (0, helpers_1.at)(i, PROJECT_STATUSES),
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.project.createMany({ data: chunk, skipDuplicates: true }), projectsData);
    const projectIds = projectsData.map((p) => p.id);
    const tasksData = Array.from({ length: tasksCount }, (_, i) => ({
        id: `seed-task-${i + 1}`,
        tenantId,
        projectId: (0, helpers_1.at)(i, projectIds),
        title: `Task ${i + 1}`,
        status: (0, helpers_1.at)(i, TASK_STATUSES),
        dueDate: (0, helpers_1.dateOffset)((i - tasksCount) * 86400000),
        assignedToUserId: i % 5 === 0 ? adminUserId : null,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.task.createMany({ data: chunk, skipDuplicates: true }), tasksData);
    console.log(`  ${projectsCount} projects, ${tasksCount} tasks`);
}
//# sourceMappingURL=projects-tasks-seeder.js.map