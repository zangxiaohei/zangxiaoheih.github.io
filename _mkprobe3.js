// 生成探针页：加载线上后台，强制显示后台视图，模拟点击「提醒自检」和「退出登录」，报告结果
const fs = require('fs');
const https = require('https');

const LIVE = 'https://zangxiaohei.github.io/zangxiaoheih.github.io/admin-app/index.html';

https.get(LIVE + '?nocache=' + Date.now(), (res) => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    const probe = `
<script>
window.__r = {};
window.addEventListener('error', function(e){ window.__r.err = e.message; });
setTimeout(function(){
  try {
    var admin = document.getElementById('view-admin');
    window.__r.hasAdminView = !!admin;
    if (admin) admin.classList.remove('hidden');
    var d = document.getElementById('btn-diag');
    window.__r.hasBtnDiag = !!d;
    if (d) { d.click(); }
    setTimeout(function(){
      window.__r.diagOpened = !!document.getElementById('diag-wrap');
      /* 关掉自检再点退出 */
      var w = document.getElementById('diag-wrap'); if (w) w.remove();
      var lo = document.getElementById('btn-logout');
      window.__r.hasBtnLogout = !!lo;
      if (lo) lo.click();
      setTimeout(function(){
        window.__r.maskShown = !!document.getElementById('logout-mask');
        window.__r.loginShown = !document.getElementById('view-login').classList.contains('hidden');
        window.__r.ver = (document.body.innerHTML.match(/版本 \\d{14}/)||['?'])[0];
        document.title = 'P|' + JSON.stringify(window.__r);
      }, 600);
    }, 600);
  } catch(e) { document.title = 'P|' + JSON.stringify({exc: e.message}); }
}, 1500);
</scr` + `ipt>`;
    html = html.replace("</body>", probe + '<img src="/hold" width="1" height="1">' + "</body>");
    fs.writeFileSync('admin-app/_probe_click.html', html);
    console.log('probe ok, bytes=' + html.length);
  });
});
