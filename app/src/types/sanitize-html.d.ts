declare module "sanitize-html" {
  export interface IOptions {
    allowedTags?: string[] | false;
    allowedAttributes?: Record<string, string[]> | false;
    allowedSchemesByTag?: Record<string, string[]>;
    transformTags?: Record<
      string,
      (
        tagName: string,
        attribs: Record<string, string>
      ) => { tagName: string; attribs: Record<string, string> }
    >;
    exclusiveFilter?: (frame: {
      tag: string;
      attribs: Record<string, string>;
    }) => boolean;
  }
  export interface Sanitize {
    (dirty: string, options?: IOptions): string;
    defaults: {
      allowedTags: string[];
      allowedAttributes: Record<string, string[]>;
    };
  }
  const sanitize: Sanitize;
  export default sanitize;
}
