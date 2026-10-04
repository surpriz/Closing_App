function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// What lands in the email. Plain words only: nothing may hint that reading is followed.
export function linkHtml(url: string, title: string) {
  return `<div><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></div>`;
}
