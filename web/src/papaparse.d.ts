declare module "papaparse" {
  export interface ParseError {
    row?: number;
    message?: string;
    code?: string;
  }

  export interface ParseMeta {
    fields?: string[];
    [key: string]: unknown;
  }

  export interface ParseResult<T = unknown> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface PapaStatic {
    parse<T = unknown>(input: string | File, config?: Record<string, unknown>): ParseResult<T>;
  }

  const Papa: PapaStatic;
  export default Papa;
}
