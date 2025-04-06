// noinspection SqlResolve
/* tslint:disable:no-console */

import { RqDriver, newRemoteQuery, PRecord, ProcessSql, RqResult, RqServiceEntry, splitStatements } from '../src';

describe('RemoteQuery tests', () => {
  // before(() => {}); // the tests container
  it('new instance, shell test...', async () => {
    const processSql: ProcessSql = async (sql: string, parameters?: PRecord) => {
      console.log(sql, parameters);

      const dummyResult: RqResult = { rowsAffected: 0 };
      return dummyResult;
    };

    const driver: RqDriver = {
      processSql,
      destroy: async () => {
        console.log('destroy');
      }
    };
    const serviceEntries: RqServiceEntry[] = [];

    const rq = newRemoteQuery(driver, serviceEntries);
    rq.setSplitStatementFunction(splitStatements);

    const result = await rq.run({ serviceId: 'dummy', parameters: {} });

    console.log(result.rowsAffected);
  });
});
