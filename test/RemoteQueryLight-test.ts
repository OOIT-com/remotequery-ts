// noinspection SqlResolve
/* tslint:disable:no-console */

import { DriverLight, newRemoteQueryLight, PRecord, ProcessSql, Result, ServiceEntry, splitStatements } from '../src';

describe('RemoteQueryLight tests', () => {
  // before(() => {}); // the tests container
  it('new instance, shell test...', async () => {
    const processSql: ProcessSql = async (sql: string, parameters?: PRecord) => {
      console.log(sql, parameters);

      const dummyResult: Result = { rowsAffected: 0 };
      return dummyResult;
    };

    const driver: DriverLight = {
      processSql,
      destroy: () => {
        console.log('destroy');
      }
    };
    const serviceEntries: ServiceEntry[] = [];

    const rq = newRemoteQueryLight(driver, serviceEntries);
    rq.setSplitStatementFunction(splitStatements);

    const result = await rq.run({ serviceId: 'dummy', parameters: {} });

    console.log(result.rowsAffected);
  });
});
