const defaultDatasets = [
  { table: 'Machine Breakdown', issueType: 'unexpected_breakdown' },
  { table: 'Overheating', issueType: 'overheating' },
  { table: 'Excessive Vibration', issueType: 'excessive_vibration' }
];

function datasetConfig() {
  const value = process.env.SUPABASE_TECHNICIAN_TABLES;
  if (!value) return defaultDatasets;
  return value.split(',').map(item => {
    const [table, issueType] = item.trim().split('|');
    if (!table || !issueType) throw new Error('SUPABASE_TECHNICIAN_TABLES must use Table Name|issue_type pairs');
    return { table, issueType };
  });
}

const keyFor = (row, requested) => Object.keys(row).find(key => key.replace(/[^a-z0-9]/gi, '').toLowerCase() === requested);
const valueFor = (row, ...names) => {
  for (const name of names) {
    const key = keyFor(row, name.replace(/[^a-z0-9]/gi, '').toLowerCase());
    if (key && row[key] != null) return row[key];
  }
  return null;
};

function normalize(row, issueType) {
  return {
    technician_id: valueFor(row, 'technicianid', 'userid', 'id'),
    name: valueFor(row, 'technicianname', 'name'),
    location: valueFor(row, 'location', 'site'),
    skill_focus: valueFor(row, 'skillfocus', 'skill'),
    rating: Number(valueFor(row, 'rating') ?? 0),
    issue_type: issueType
  };
}

export function createSupabaseCatalog() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const configured = Boolean(url && key);

  async function request(table) {
    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(table)}?select=*`;
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`Supabase table "${table}" could not be read (${response.status}). Check the table name and RLS policy.`);
    return response.json();
  }

  return {
    configured,
    async technicians() {
      if (!configured) throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
      const datasets = datasetConfig();
      const groups = await Promise.all(datasets.map(async dataset => (await request(dataset.table)).map(row => normalize(row, dataset.issueType))));
      return groups.flat().filter(technician => technician.technician_id || technician.name);
    },
    issueTypes() { return datasetConfig().map(({ table, issueType }) => ({ issue_type: issueType, label: table })); }
  };
}
