"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDocuments = seedDocuments;
const helpers_1 = require("./helpers");
const DOC_TYPES = ['PDF', 'XLSX', 'DOCX'];
const CATEGORIES = ['Governance', 'Insurance', 'Financial', 'Contracts', 'Safety'];
async function seedDocuments(prisma, ctx) {
    const { tenantId, counts, adminUserId } = ctx;
    const count = counts.documents;
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-doc-${i + 1}`,
        tenantId,
        name: `Document ${i + 1}`,
        documentType: (0, helpers_1.at)(i, DOC_TYPES),
        category: (0, helpers_1.at)(i, CATEGORIES),
        uploadedByUserId: adminUserId,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.document.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} documents`);
}
//# sourceMappingURL=documents-seeder.js.map