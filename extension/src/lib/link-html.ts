function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// What lands in the email: a small card with the title and a call to open it.
// A table with inline styles, the form Gmail and Outlook render the same way.
// Plain words only: nothing may hint that reading is followed.
export function linkHtml(url: string, title: string) {
  const href = escapeHtml(url);
  return (
    `<div><table cellpadding="0" cellspacing="0" role="presentation" ` +
    `style="border:1px solid #e3e1dc;border-radius:10px;border-collapse:separate;margin:8px 0">` +
    `<tr><td style="padding:12px 18px 12px 14px;font-family:Arial,Helvetica,sans-serif">` +
    `<a href="${href}" style="text-decoration:none;color:#0f1e33;font-size:15px;font-weight:bold">&#128196;&nbsp; ${escapeHtml(title)}</a><br>` +
    `<a href="${href}" style="text-decoration:none;color:#c2410c;font-size:13px">Consulter le document &rarr;</a>` +
    `</td></tr></table></div><div><br></div>`
  );
}
