export type SRecord = Record<string, string>;
export type PRecord = Record<string, boolean | string | number>;

export type Request = {
  userId?: string;
  roles?: string[];
  serviceId: string;
  parameters: PRecord;
};
export type Context = {
  recursion: number;
  contextId: number;
  rowsAffectedList: number[];
  userMessages: string[];
  systemMessages: string[];
  statusCode: number;
  includes: Record<string, number>;
  maxRows?: number;
  serviceEntry?: ServiceEntry;
  txId?: string;
};

export type ServiceFun = (request: Request, context?: Partial<Context>) => Promise<Result>;

export type ServiceEntry = {
  serviceId: string;
  roles?: string[];
  statements?: string;
  service?: ServiceFun;
  tags?: Set<string>;
  origin?: string;
};

export interface ExceptionResult {
  exception: string;
  stack?: string;
}

export interface Result extends Partial<ExceptionResult> {
  name?: string;
  types?: string[];
  headerSql?: string[];
  header?: string[];
  table?: string[][];
  rowsAffected?: number;
  from?: number;
  hasMore?: boolean;
}

export interface ResultWithData extends Result {
  header: string[];
  table: string[][];
}

// export type StartBlockType<E = string> = 'if' | 'if-else' | 'switch' | 'while' | 'foreach' | E;
// export type EndBlockType<E = string> = 'fi' | 'done' | 'end' | E;
// export type RegistryType<E = string> = 'node' | 'sql' | E;
// export type CommandsType = {
//   StartBlock: Record<StartBlockType, true>;
//   EndBlock: Record<EndBlockType, true>;
//   Registry: Record<RegistryType, RegistryObjFun>;
//   Node: Record<string, RegistryObjFun>;
// };

export interface RegistryObj {
  request: Request;
  currentResult: Result;
  statementNode: StatementNode;
  serviceEntry: ServiceEntry;
  context: Context;
}

export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';
export type LoggerFun = (msg: string) => void;
export type Logger = Record<LoggerLevel, LoggerFun>;
export type ProcessSql = (sql: string, parameters?: PRecord, context?: Partial<Context>) => Promise<Result>;
export type ProcessSqlDirect = (sql: string, values: string[], maxRows: number) => Promise<Result>;
export type GetServiceEntry = (serviceId: string) => Promise<ServiceEntry | ExceptionResult>;

export interface DriverLight {
  processSql: ProcessSql;
  destroy: () => void;
}

export interface Driver<ConnectionType = any> extends DriverLight {
  // processSql: ProcessSql;
  processSqlDirect: ProcessSqlDirect;
  getServiceEntry: GetServiceEntry;

  returnConnection: (con: ConnectionType) => void;
  getConnection: () => Promise<ConnectionType | undefined>;

  startTransaction: () => Promise<string>;
  commitTransaction: (txId: string) => Promise<void>;
  rollbackTransaction: (txId: string) => Promise<void>;

  // destroy: () => void;
}

export type RqResultOrList = Result | SRecord[];
export type RegistryObjFun = (registerObj: RegistryObj) => Promise<Result | undefined>;
export type StatementNode = {
  cmd: string;
  statement: string;
  parameter: string;
  children?: StatementNode[];
};

export type EmtpyResult = Record<string, string>;

export type SqlStatementWithFilename = { text: string; origin: string };
export type SqlFilesContent = { serviceEntries: ServiceEntry[]; sqlStatements: SqlStatementWithFilename[] };
export type SplitStatementFunction = (s: string) => string[];
