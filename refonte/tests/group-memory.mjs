function values(doc, path) {
  if (!path.length) return [doc];
  if (Array.isArray(doc)) return doc.flatMap(value => values(value, path));
  return values(doc?.[path[0]], path.slice(1));
}
function matches(doc, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = values(doc, key.split('.'));
    if (expected && typeof expected === 'object' && '$exists' in expected)
      return actual.some(value => value !== undefined) === expected.$exists;
    return actual.some(value => value === expected);
  });
}
export function groupMemory() {
  const rows = [];
  return {rows,
    async findOne(filter) { return structuredClone(rows.find(row => matches(row, filter)) || null); },
    async insertOne(row) {
      if (rows.some(other => other.id === row.id || row.inviteHash && other.inviteHash === row.inviteHash))
        throw Object.assign(Error('duplicate'), {code:11000});
      rows.push(structuredClone(row));
    },
    async updateOne(filter, update) {
      const row = rows.find(row => matches(row, filter));
      if (!row) return {matchedCount:0};
      Object.assign(row, structuredClone(update.$set)); return {matchedCount:1};
    },
    find(filter) {
      let found = rows.filter(row => matches(row, filter));
      return {sort() { found.sort((a,b) => b.updatedAt - a.updatedAt); return this; },
        limit(limit) { found = found.slice(0,limit); return this; }, async toArray() { return structuredClone(found); }};
    }
  };
}
