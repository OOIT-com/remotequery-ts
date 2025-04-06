/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types,space-before-function-paren */
/* tslint:disable:no-string-literal */
/* tslint:disable:one-variable-per-declaration */
/* tslint:disable:only-arrow-functions */
/* tslint:disable:no-explicit-any */
// tslint:disable:no-console
import camelCase from 'camelcase';
import { builtins } from 'pg-types';

import moment from 'moment';
import { Context, PRecord, RqDriver, RqResult } from '../../types';
import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import { nameTransformer } from './named-transformer';
import { isError, isExceptionResult } from '../../utils';

const defaultTimeout5Min = 300000;

export class PSQLDriver implements RqDriver {
  private readonly pool: Pool | undefined;
  private readonly txConnections: Record<string, PoolClient> = {};
  private txConnectionCounter = 1;

  private serviceEntrySql = '';

  constructor(poolConfig: PoolConfig) {
    const pc = { ...poolConfig, statement_timeout: defaultTimeout5Min };
    this.pool = new Pool(pc);
  }

  public async startTransaction() {
    const txIdNumber = this.txConnectionCounter++;
    const txId = `PoolClient${txIdNumber}`;
    const con = await this.getConnection();
    if (!con) {
      return '';
    }
    await con.query('BEGIN');
    this.txConnections[txId] = con;
    return txId;
  }

  public async commitTransaction(txId: string) {
    const con = this.txConnections[txId];
    if (!con) {
      throw new Error(`Try to commit. No connection available for txId: ${txId}`);
    }
    await con.query('COMMIT');
    this.returnConnection(con);
  }

  public async rollbackTransaction(txId: string) {
    const con = this.txConnections[txId];
    if (!con) {
      throw new Error(`Try to rollback. No connection available for txId: ${txId}`);
    }
    await con.query('ROLLBACK');
    this.returnConnection(con);
  }

  public setServiceEntrySql(sql: string) {
    this.serviceEntrySql = sql;
  }

  public async getConnection(): Promise<PoolClient | undefined> {
    if (this.pool) {
      return this.pool.connect();
    }
    return undefined;
  }

  public returnConnection(con: any): void {
    try {
      if (this.pool) {
        con.release();
      }
    } catch (e) {
      console.error(`returnConnection -> ${e}`);
    }
    console.debug('returnConnection DONE');
  }

  public async processSql(sql: string, parameters?: PRecord, context?: Partial<Context>): Promise<RqResult> {
    let con, result: RqResult;
    const { maxRows, txId } = context || {};
    try {
      con = txId ? this.txConnections[txId] : await this.getConnection();
      if (con) {
        result = await processSqlWithConnection(con, sql, parameters, maxRows);
      } else {
        result = { exception: 'No connection received!' };
      }
    } catch (err: any) {
      console.error(`processSql error message: ${err.message}\n err.stack: ${err.stack}`);
      result = { exception: err.message };
    } finally {
      if (con) {
        if (!txId) {
          this.returnConnection(con);
        }
      }
    }
    return result;
  }

  public async processSqlDirect(sql: string, values: never[], maxRows = 50000): Promise<RqResult> {
    let con: PoolClient | undefined;
    let result: RqResult = { exception: 'Unknown error!' };
    try {
      con = await this.getConnection();
      if (con) {
        result = await processSqlQuery(con, sql, values as never, maxRows);
      } else {
        const exception = 'No connection received!';
        console.warn(exception);
        result = { exception };
      }
    } catch (err: unknown) {
      if (isError(err)) {
        console.error(`processSqlDirect: err.message = ${err.message}, err.stack = ${err.stack}`);
        result = { exception: err.message };
      }
    } finally {
      if (con) {
        this.returnConnection(con);
      }
    }
    return result;
  }

  public async end() {
    if (this.pool) {
      this.pool.end(() => console.info('PSQL Connection Pool ended.'));
    }
  }

  public async destroy(): Promise<void> {
    return this.end();
  }
}

function convertType(value: any, sqlType: number) {
  if (value === null || value === undefined) {
    return '';
  }

  try {
    if ((sqlType === builtins.TIMESTAMPTZ || sqlType === builtins.TIMESTAMP) && value instanceof Date) {
      return moment(value).format('YYYY-MM-DD HH:mm');
    }
    if (sqlType === builtins.DATE && value instanceof Date) {
      return moment(value).format('YYYY-MM-DD');
    }
  } catch (e: unknown) {
    if (isError(e)) {
      console.error(e.message);
    }
  }
  return '' + value;
}

export const queryResult2RqResult = (queryResult: QueryResult, maxRows: number): RqResult => {
  const result: RqResult = {};

  result.rowsAffected = -1;
  result.from = 0;
  result.hasMore = false;
  result.headerSql = [];
  result.header = [];
  result.table = [];
  result.rowsAffected = queryResult.rowCount ?? -1;
  if (queryResult.command === 'SELECT') {
    result.rowsAffected = -1;
    result.header =
      typeof queryResult.fields === 'object'
        ? queryResult.fields.map((f) => {
            // const c = cc(f.name);
            return camelCase(f.name);
          })
        : undefined;
    result.headerSql = typeof queryResult.fields === 'object' ? queryResult.fields.map((f) => f.name) : undefined;
    for (const row of queryResult.rows) {
      const trow = result.headerSql?.map((h, index) => convertType(row[h], queryResult.fields[index].dataTypeID));
      if (trow) {
        result.table.push(trow);
        if (maxRows === result.table.length) {
          result.hasMore = true;
          break;
        }
      }
    }
  }
  return result;
};

export const processSqlWithConnection = async (
  con: PoolClient,
  sql: string,
  parameters: PRecord = {},
  maxRows = 50000
): Promise<RqResult> => {
  parameters = parameters || {};
  maxRows = maxRows || 50000;

  console.debug('start sql **************************************');
  console.debug(`sql: ${sql}`);

  const trans = nameTransformer(sql);

  //
  // PREPARE SERVICE_STMT
  //

  const values = [];

  for (const n of trans.parameterNames) {
    if (parameters[n] === undefined) {
      console.debug(`no value provided for parameter: ${n} will use NULL value`);
      values.push(null);
    } else {
      const v = parameters[n];
      values.push(v);
      console.debug(`sql-parameter: ${n}=${v}`);
    }
  }

  return await processSqlQuery(con, trans.sqlt, values as never, maxRows);
};

export const processSqlQuery = async (
  con: PoolClient,
  sql: string,
  values: never,
  maxRows: number
): Promise<RqResult> => {
  const queryResult = await con.query(sql, values);
  if (isExceptionResult(queryResult)) {
    return queryResult;
  }
  const r = queryResult2RqResult(queryResult, maxRows);
  return { ...r };
};
