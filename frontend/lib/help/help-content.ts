export type HelpTopic = { title: string; steps: { title: string; description: string }[] };

// Texts live in messages/*.json under "help.topics.{id}". Order matters: the first
// matching entry wins, so more specific paths come before their parents.
const helpEntries: { id: string; test: (path: string) => boolean }[] = [
  { id: "overview", test: (path) => path === "/" },
  { id: "surveys", test: (path) => path === "/surveys" },
  { id: "surveyNew", test: (path) => path === "/surveys/new" },
  { id: "draft", test: (path) => /^\/surveys\/[^/]+\/drafts\/[^/]+$/.test(path) },
  { id: "version", test: (path) => /^\/surveys\/[^/]+\/versions\/[^/]+$/.test(path) },
  { id: "surveyDetail", test: (path) => /^\/surveys\/[^/]+$/.test(path) },
  { id: "workspaces", test: (path) => path === "/workspaces" },
  { id: "workspaceNew", test: (path) => path === "/workspaces/new" },
  { id: "workspaceEdit", test: (path) => /^\/workspaces\/[^/]+\/edit$/.test(path) },
  { id: "campaignNew", test: (path) => /^\/workspaces\/[^/]+\/campaigns\/new$/.test(path) },
  { id: "campaignDetail", test: (path) => /^\/workspaces\/[^/]+\/campaigns\/[^/]+$/.test(path) },
  { id: "campaigns", test: (path) => /^\/workspaces\/[^/]+\/campaigns$/.test(path) },
  { id: "recipients", test: (path) => /^\/workspaces\/[^/]+\/recipients$/.test(path) },
  { id: "analytics", test: (path) => /^\/workspaces\/[^/]+\/analytics$/.test(path) },
  { id: "workspaceDetail", test: (path) => /^\/workspaces\/[^/]+$/.test(path) },
  { id: "users", test: (path) => path === "/administration/users" },
  { id: "email", test: (path) => path === "/administration/email" },
];

export function getHelpTopicId(path: string): string {
  return helpEntries.find(({ test }) => test(path))?.id ?? "default";
}
