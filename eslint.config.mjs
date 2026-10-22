import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: [".next/**", "node_modules/**", "package-lock.json"] },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // The site uses plain anchors so each page is a full load. Leave that as-is.
      "@next/next/no-html-link-for-pages": "off",
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
