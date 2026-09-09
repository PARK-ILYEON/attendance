---
name: External npm lockfiles
description: Replit's package firewall can persist in npm environment settings and hidden node_modules lock metadata.
---

When generating a package-lock.json for an external deployment, remove node_modules and regenerate with the user npm config disabled and registry.npmjs.org explicitly selected.

**Why:** A project .npmrc may be absent while Replit's environment variables or node_modules/.package-lock.json still cause resolved URLs to point at the internal package firewall, which external hosts cannot reach.

**How to apply:** Verify package-lock.json contains https://registry.npmjs.org/ URLs and no package-firewall.replit.local or package-firewall.replit.internal URLs before handing the project to an external deployment platform.