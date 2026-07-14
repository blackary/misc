// Paste this in the Chrome DevTools console while on your Slack emoji page
// (https://<your-workspace>.slack.com/customize/emoji)
// It will prompt you to pick your emojis folder and upload all images.

(async () => {
  // Extract token from boot_data on the page
  let token;
  document.querySelectorAll('script[type="text/javascript"]').forEach(s => {
    const m = s.textContent.match(/"api_token":"([^"]+)"/);
    if (m) token = m[1];
  });
  if (!token) { console.error('Token not found'); return; }
  console.log('Token found. Pick your emojis folder when prompted...');

  // Let you pick the folder (File System Access API)
  const dir = await window.showDirectoryPicker();
  const files = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file' && /\.(png|gif|jpg|jpeg|webp)$/i.test(name))
      files.push(handle);
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Found ${files.length} files. Uploading...`);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = await files[i].getFile();
    const name = files[i].name.replace(/\.[^.]+$/, '')
      .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const prefix = `[${String(i+1).padStart(3)}/${files.length}]`;

    let done = false, attempts = 0;
    while (!done && attempts < 4) {
      attempts++;
      const fd = new FormData();
      fd.append('name', name); fd.append('mode', 'data');
      fd.append('token', token); fd.append('image', file);
      try {
        const json = await fetch('/api/emoji.add', { method: 'POST', body: fd }).then(r => r.json());
        if (json.ok)                               { console.log(`${prefix} ✓ :${name}:`); success++; done = true; }
        else if (json.error === 'ratelimited')     { console.log(`${prefix} rate limited — waiting 10s…`); await sleep(10000); }
        else if (json.error === 'error_name_taken'){ console.log(`${prefix} ~ :${name}: already exists`); skipped++; done = true; }
        else                                       { console.log(`${prefix} ✗ :${name}: ${json.error}`); failed++; done = true; }
      } catch(e) {
        if (attempts >= 4) { failed++; done = true; } else await sleep(2000);
      }
    }
    if (done && i < files.length - 1) await sleep(1200);
  }
  console.log(`\nDone: ${success} uploaded, ${skipped} already existed, ${failed} failed`);
})();
