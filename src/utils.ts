/* tslint:disable:no-string-literal */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */

import {
  ExceptionResult,
  Logger,
  PRecord,
  Result,
  ResultWithData,
  RqResultOrList,
  SplitStatementFunction,
  SRecord
} from './types';

export const isError = (error: any): error is Error => {
  return typeof error.message === 'string' && typeof error.name === 'string';
};

export function exceptionResult(e: string | Error | unknown): ExceptionResult {
  if (isError(e)) {
    return { exception: e.message, stack: e.stack };
  } else if (typeof e === 'string') {
    return { exception: e };
  }
  return { exception: 'Unknown' };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isExceptionResult = (data: any): data is ExceptionResult => {
  return data && typeof data.exception === 'string';
};

export function trim(str: string): string {
  if (!str) {
    return '';
  }
  return str.trim();
}

export function noop() {
  // noop
}

export const consoleLogger: Logger = {
  // tslint:disable-next-line:no-console
  debug: (msg: string) => console.debug('debug', msg),
  // tslint:disable-next-line:no-console
  info: (msg: string) => console.info('info', msg),
  // tslint:disable-next-line:no-console
  warn: (msg: string) => console.warn('warn', msg),
  // tslint:disable-next-line:no-console
  error: (msg: string) => console.error('error', msg)
};

export const noopLogger: Logger = {
  // tslint:disable-next-line:no-console
  debug: noop,
  // tslint:disable-next-line:no-console
  info: noop,
  // tslint:disable-next-line:no-console
  warn: noop,
  // tslint:disable-next-line:no-console
  error: noop
};

export function toResult(list: SRecord[], name = 'toResult'): Result {
  const header: string[] = [];
  const table: string[][] = [];
  if (list && list.length > 0) {
    Object.keys(list[0]).forEach((k) => header.push(k));
    list.forEach((e) => table.push(header.map((h) => e[h] ?? '')));
  }
  return { name, header, table };
}

export const toSRecord = (r: PRecord) =>
  Object.entries(r).reduce<SRecord>((a, [k, v]) => {
    a[k] = v.toString();
    return a;
  }, {});

export function toList<R extends SRecord>(data: RqResultOrList): R[] {
  if (Array.isArray(data)) {
    return data as any;
  }

  if (!data?.header || !data?.table) {
    return [];
  }

  const header = data.header;
  const list: Record<string, string>[] = [];
  data.table.forEach((row: string[]) => {
    const nrow: Record<string, string> = {};
    list.push(nrow);
    row.forEach((v, index) => {
      const head = header[index] || 'name' + index;
      nrow[head] = v;
    });
  });

  return list as R[];
}

export function toMap(data: RqResultOrList, keyColumn: string, valueColumn: string): SRecord {
  const list = toList(data);
  return list.reduce((a: any, e: any) => {
    a[e[keyColumn]] = valueColumn ? e[valueColumn] : e;
    return a;
  }, {});
}

export function toFirst<R = SRecord>(data: RqResultOrList): R | undefined {
  if (Array.isArray(data)) {
    return data[0] as R;
  }
  if (typeof data === 'object' && Array.isArray(data.header) && Array.isArray(data.table)) {
    return toList(data)[0] as R;
  }
  return undefined;
}

export const toSingle = (r: Result): string => r.table?.[0]?.[0] ?? '';

export const toResultWithData = (r: Result): ResultWithData | false =>
  Array.isArray(r.header) && Array.isArray(r.table) ? (r as ResultWithData) : false;

export const checkAccess = (providedRoles: string[] = [], requestedRoles: string[] = []): string => {
  let hasAccess = false;
  if (requestedRoles.length === 0) {
    hasAccess = true;
  } else {
    for (const role of providedRoles) {
      if (requestedRoles.includes(role)) {
        hasAccess = true;
        break;
      }
    }
  }
  if (hasAccess) {
    return '';
  } else {
    return `no access: provided roles: ${providedRoles.join(',')}; requestedRoles: ${requestedRoles.join('')}`;
  }
};

export const splitStatements: SplitStatementFunction = (statements: string): string[] =>
  statements
    .split(';')
    .map((e) => e.trim())
    .filter((e) => !!e);
