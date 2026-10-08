import './load-env.js';

if (process.env.APP_DATABASE === 'supabase') {
  await import('./server-supabase.js');
} else {
  await import('./server.js');
}
