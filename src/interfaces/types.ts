export type Key = string | Array<string>;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any  */
export type Object = { [key: string]: any };

export interface ProcessEnv {
  [key: string]: string | undefined
}
