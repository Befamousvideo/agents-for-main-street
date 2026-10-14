import site from "../../content/site.json";
export const dynamic = "force-static";
export function GET() {
  const t = `# ${site.name}\n\n> ${site.description}\n\n## Key pages\n` + site.pages.map(p => `- [${p.title}](https://${site.domain}${p.path}): ${p.summary}`).join("\n") + `\n\n## About\n` + site.static.map(p => `- [${p.title}](https://${site.domain}${p.path})`).join("\n") + "\n";
  return new Response(t, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
