declare module 'better-sqlite3' {
  export interface Database {
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
    pragma(pragma: string): any;
  }

  export interface Statement {
    run(...params: any[]): RunResult;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }

  export interface RunResult {
    lastInsertRowid: number | bigint;
    changes: number;
  }

  export default class Database {
    constructor(filename: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
    pragma(pragma: string): any;
  }
}
