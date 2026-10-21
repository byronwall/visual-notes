// The credential reader lives with the browser-check kit so plain `node`
// scripts can use it without a TypeScript loader.
export { readTestCredential } from "../../../scripts/browser/credential.mjs";
