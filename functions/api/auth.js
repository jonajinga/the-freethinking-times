// Cloudflare Pages Function — GitHub OAuth proxy for Decap CMS
// Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars set in Cloudflare Pages.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Cloudflare-Pages-CMS-Auth'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    const data = await res.json();

    if (data.error) {
      const msg = JSON.stringify('authorization:github:error:' + (data.error_description || data.error));
      return html(`sendMsg(${msg});`);
    }

    const payload = JSON.stringify({ token: data.access_token, provider: 'github' });
    const msg = JSON.stringify('authorization:github:success:' + payload);
    return html(`sendMsg(${msg});`);
  }

  const redirectUri = `${url.origin}/api/auth`;
  const scope = url.searchParams.get('scope') || 'repo,user';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  return Response.redirect(authUrl, 302);
}

function html(script) {
  return new Response(`<!DOCTYPE html><html><body>
<pre id="log" style="font-family:monospace;padding:2rem;white-space:pre-wrap"></pre>
<script>
function log(s) { document.getElementById('log').textContent += s + '\\n'; }
function sendMsg(msg) {
  log('opener: ' + (window.opener ? 'present' : 'NULL'));
  log('msg prefix: ' + msg.slice(0, 40));
  if (window.opener) {
    window.opener.postMessage(msg, '*');
    log('postMessage sent — closing in 3s');
    setTimeout(function() { window.close(); }, 3000);
  } else {
    log('opener lost — cannot deliver token');
  }
}
${script}
<\/script>
</body></html>`, { headers: { 'Content-Type': 'text/html' } });
}
