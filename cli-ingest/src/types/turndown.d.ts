declare module "turndown" {
  export default class TurndownService {
    constructor(options?: unknown);
    turndown(html: string): string;
  }
}
