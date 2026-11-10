import { SELF } from "./network";
export const PLANS = {
  rotating: { id: "rotating", name: "Sponsor slot (rotating)", price: 7900, days: 30, desc: "Your ad rotates in the ad spot on content pages for 30 days." },
  featured: { id: "featured", name: "Featured (exclusive)", price: 19900, days: 30, desc: "Your ad takes priority in the ad spot on every content page for 30 days." },
};
export const CATEGORIES = ["Software / SaaS", "Local service business", "Professional services", "Education / training", "Nonprofit / community", "Retail / e-commerce", "Other"];
export const COMPETITORS = {
  afms: "AI automation agencies, AI consultants, \"done-for-you\" automation builders, and other AI/automation recipe libraries for small businesses",
  viberescue: "app security audit or \"vibe code rescue\" services, code-review/fix-it agencies, and other AI-app security guide sites",
  ptaplaybook: "other PTA/PTO playbook, template or management products that compete directly with PTA Playbook",
};
export const competitorText = () => `${COMPETITORS[SELF] || "products that compete with this site"}, or any business that competes with StorenTech AI (AI strategy, consulting or custom AI builds)`;
