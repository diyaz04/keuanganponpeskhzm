const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const parts = line.trim().split('=');
  if (parts.length > 1) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    acc[key] = val;
  }
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('tabungan_mutasi').insert([{
     santri_id: '00000000-0000-0000-0000-000000000000',
     tipe: 'setor',
     nominal: 1000,
     saldo_berjalan: 1000,
     input_by: '00000000-0000-0000-0000-000000000000'
  }]);
  console.log(JSON.stringify({error}, null, 2));
}
run();
