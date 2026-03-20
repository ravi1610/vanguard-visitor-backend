"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.at = at;
exports.dateOffset = dateOffset;
exports.label = label;
exports.createManyBatched = createManyBatched;
function at(index, arr) {
    return arr[index % arr.length];
}
function dateOffset(ms) {
    return new Date(Date.now() + ms);
}
function label(name, i) {
    return `${name} ${i + 1}`;
}
const BATCH_SIZE = 100;
async function createManyBatched(createMany, data) {
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const chunk = data.slice(i, i + BATCH_SIZE);
        await createMany(chunk);
    }
}
//# sourceMappingURL=helpers.js.map