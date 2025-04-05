/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types,space-before-function-paren */
/* tslint:disable:no-string-literal */
/* tslint:disable:one-variable-per-declaration */
/* tslint:disable:only-arrow-functions */
/* tslint:disable:no-explicit-any */
// tslint:disable:no-console
import camelCase from 'camelcase';
import { builtins } from 'pg-types';

import moment from 'moment';
import { Context, DriverLight, ExceptionResult, PRecord, Result } from '../../types';
import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import { nameTransformer } from './named-transformer';
import { isError, isExceptionResult } from '../../utils';

const defaultTimeout5Min = 300000;

export class PSQLDriver implements DriverLight {
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
    const client = await this.getConnection();
    if (!client) {
      return '';
    }
    await client.query('BEGIN');
    this.txConnections[txId] = client;
    return txId;
  }

  public async commitTransaction(txId: string) {
    const client = this.txConnections[txId];
    if (!client) {
      throw new Error(`Try to commit. No connection available for txId: ${txId}`);
    }
    await client.query('COMMIT');
    this.returnConnection(client);
  }

  public async rollbackTransaction(txId: string) {
    const client = this.txConnections[txId];
    if (!client) {
      throw new Error(`Try to rollback. No connection available for txId: ${txId}`);
    }
    await client.query('ROLLBACK');
    this.returnConnection(client);
  }

  public async end() {
    if (this.pool) {
      this.pool.end(() => console.info('PSQL Connection Pool ended.'));
    }
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

  public async processSql(sql: string, parameters?: PRecord, context?: Partial<Context>): Promise<Result> {
    let con, result: Result;
    const { maxRows, txId } = context || {};
    try {
      con = txId ? this.txConnections[txId] : await this.getConnection();
      if (con) {
        result = await this.processSql_con(con, sql, parameters, maxRows);
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

  public async processSqlDirect(sql: string, values: any = null, maxRows = 50000): Promise<Result> {
    let con: PoolClient | undefined, result;
    try {
      con = await this.getConnection();
      if (con) {
        result = await this.processSqlQuery(con, sql, values as never, maxRows);
      } else {
        const exception = 'No connection received!';
        console.warn(exception);
        result = { exception };
      }
    } catch (err: any) {
      console.error(`processSqlDirect: err.message = ${err.message}, err.stack = ${err.stack}`);
      result = { exception: err.message };
    } finally {
      if (con) {
        this.returnConnection(con);
      }
    }
    return result;
  }

  public async processSql_con(con: PoolClient, sql: string, parameters: PRecord = {}, maxRows = 50000) {
    parameters = parameters || {};
    maxRows = maxRows || 50000;

    console.debug('start sql **************************************');
    console.debug(`sql: ${sql}`);

    const trans = nameTransformer(sql);

    //
    // PREPARE SERVICE_STMT
    //

    const sqlParams = [];

    for (const n of trans.parameterNames) {
      if (parameters[n] === undefined) {
        console.debug(`no value provided for parameter: ${n} will use NULL value`);
        sqlParams.push(null);
      } else {
        const v = parameters[n];
        sqlParams.push(v);
        console.debug(`sql-parameter: ${n}=${v}`);
      }
    }

    return await this.processSqlQuery(con, trans.sqlt, sqlParams as never, maxRows);
  }

  public async processSqlQuery(con: PoolClient, sql: string, values: never, maxRows: number): Promise<Result> {
    const queryResult = await processSqlPromise(con, sql, values);
    if (isExceptionResult(queryResult)) {
      return queryResult;
    }
    const r = this.processQueryResult(queryResult, maxRows);
    console.debug(`rowsAffected: ${r.rowsAffected}`);
    return { ...r };
  }

  processQueryResult(queryResult: QueryResult, maxRows: number): Result {
    const result: Result = {};

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
  }

  destroy(): void {
    if (this.pool) {
      this.pool.end();
    }
  }
}

function processSqlPromise(con: PoolClient, sql: string, values: never): Promise<QueryResult | ExceptionResult> {
  return new Promise(function (resolve) {
    con.query(sql, values, (err, res) => {
      if (err) {
        const valueStr = values ? (values as string[]).join('\n') : '';
        console.error(`processSqlPromise : ${sql}\n ${err.message}\n ${err.stack}\n values:\n ${valueStr}`);
        resolve({ exception: err.message });
      } else {
        resolve(res);
      }
    });
  });
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
