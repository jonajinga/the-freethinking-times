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
<script>
function sendMsg(msg) {
  if (window.opener) {
    window.opener.postMessage(msg, '*');
    setTimeout(function() { window.close(); }, 100);
  } else {
    // opener lost — store token in sessionStorage for the parent to poll
    sessionStorage.setItem('decap-oauth-msg', msg);
    document.body.innerHTML = '<p style="font-family:sans-serif;padding:2rem">Authentication complete. You may close this window.</p>';
  }
}
${script}
<\/script>
</body></html>`, { headers: { 'Content-Type': 'text/html' } });
}
