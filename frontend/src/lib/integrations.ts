// Shapes of what the backend's /api/integrations/ endpoints send. Kept in one
// place so the store page and the detail page agree on them.

// What this account can do with an integration, worked out on the server:
//   included  -> free on this plan, connect now
//   owned     -> bought already, connect now
//   one_time  -> buy once to connect
//   upgrade   -> needs the Plus plan
export type IntegrationAccess = "included" | "owned" | "one_time" | "upgrade";

// Where it stands for this account:
//   not_connected -> available, not set up yet
//   connected     -> working
//   error         -> set up, but the last change didn't go through
//   coming_soon   -> not ready on the server yet
export type IntegrationStatus = "not_connected" | "connected" | "error" | "coming_soon";

export type IntegrationSummary = {
  key: string;
  name: string;
  category: string;
  tier: "essential" | "advanced";
  tagline: string;
  sync: "one_way" | "two_way";
  access: IntegrationAccess;
  status: IntegrationStatus;
  last_error: string;
};

export type IntegrationField = {
  name: string;
  label: string;
  type: string;
  help?: string;
};

export type IntegrationStep = { title: string; details: string[] };
export type IntegrationHelpSection = { title: string; items: string[] };
export type IntegrationProblem = { problem: string; fix: string };

// The full written guide for one integration. Every section here comes from the server.
export type IntegrationGuide = {
  right_now: string;
  before_you_start: string[];
  setup: IntegrationStep[];
  help: IntegrationHelpSection[];
  can_do: string[];
  cannot_do: string[];
  coming_next: string[];
  problems: IntegrationProblem[];
};

export type IntegrationDetail = IntegrationSummary & {
  guide: IntegrationGuide;
  fields: IntegrationField[];
};

export const ACCESS_LABEL: Record<IntegrationAccess, string> = {
  included: "Included",
  owned: "Purchased",
  one_time: "One-time fee",
  upgrade: "Plus only",
};

// Colors for the access badge. Green means it's yours already, amber means it costs something.
export const ACCESS_STYLE: Record<IntegrationAccess, string> = {
  included: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  owned: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  one_time: "bg-amber-50 text-amber-800 ring-amber-600/20",
  upgrade: "bg-gray-100 text-gray-700 ring-gray-500/20",
};

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  error: "Needs attention",
  coming_soon: "Coming soon",
};

export const STATUS_STYLE: Record<IntegrationStatus, string> = {
  not_connected: "bg-gray-100 text-gray-600 ring-gray-500/20",
  connected: "bg-emerald-600 text-white ring-emerald-600",
  error: "bg-amber-100 text-amber-900 ring-amber-600/30",
  coming_soon: "bg-gray-50 text-gray-500 ring-gray-400/30",
};
