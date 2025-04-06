// tslint:disable:no-console

import { expect } from 'chai';
import {PSQLDriver} from "../src/drivers/psql/PSQLDriver";

const user = 'postgres';
const password = 'postgres';
const host = 'localhost';
const database = '';
const port = 5432;

// create table foobar(name varchar(200),age bigint)
const insertQuery = 'insert into foobar(name, age) values (:name, :age)';

describe('PSQLDriver Tests', () => {
  let psqlDriver: PSQLDriver | undefined;

  before(() => {
    psqlDriver = new PSQLDriver({ user, password, host, database, port, ssl: undefined });
  });

  after(async () => {
    if (psqlDriver) {
      await psqlDriver.processSqlDirect('delete from foobar where age > 0', []);
      await psqlDriver.destroy();
    }
  });

  it('Check connection', async () => {
    expect(!psqlDriver).equals(false);
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
    }
    const con = await psqlDriver.getConnection();
    expect(!!con).equals(true);
    if (con) {
      psqlDriver.returnConnection(con);
    }
  });

  it('Direct insertion with connection', async () => {
    expect(!psqlDriver).equals(false);
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
    }
    const con = await psqlDriver.getConnection();
    if (con) {
      try {
        await con.query("insert into foobar(name, age) values ('hans', 43)");
        const queryResult = await con.query('select * from foobar');
        if (!queryResult.rowCount) {
          expect.fail('Expected some entries!');
        }
      } catch (e) {
        console.error('Tried to select from foobar:', e);
      } finally {
        if (con) {
          psqlDriver.returnConnection(con);
        }
      }
    }
  });
  it('Insert with PSQL Driver (query and parameters)', async () => {
    expect(!psqlDriver).equals(false);
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
    }
    try {
      await psqlDriver.processSql(insertQuery, { name: 'toni', age: 23 });
    } catch (error) {
      console.error('Error creating database:', error);
    }
  });

  it('Inserts with PSQL Driver (using transaction)', async () => {
    expect(!psqlDriver).equals(false);
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
    }
    const txId = await psqlDriver.startTransaction();

    let rollBackNeeded = false;
    try {
      await psqlDriver.processSql(
        insertQuery,
        {
          name: 'toni-trans',
          age: 23
        },
        { txId }
      );

      await psqlDriver.processSql(
        insertQuery,
        {
          name: 'hans-trans',
          age: 23
        },
        { txId }
      );
      await psqlDriver.commitTransaction(txId);
    } catch (e) {
      console.log(`${e}`);
      rollBackNeeded = true;
    } finally {
      if (rollBackNeeded) {
        await psqlDriver.rollbackTransaction(txId);
      }
    }
  });

  it('Inserts with PSQL Driver (using transaction, creating rollback)', async () => {
    expect(!psqlDriver).equals(false);
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
    }
    const txId = await psqlDriver.startTransaction();

    const res1 = await psqlDriver.processSql(
      insertQuery,
      {
        name: 'toni2-trans',
        age: 23
      },
      { txId }
    );
    // should create duplicate error!
    const res2 = await psqlDriver.processSql(
      insertQuery,
      {
        name: 'hans-trans',
        age: 23
      },
      { txId }
    );
    const exception = res1.exception || res2.exception;
    if (exception) {
      await psqlDriver.rollbackTransaction(txId);
    } else {
      await psqlDriver.commitTransaction(txId);
    }
    expect(!!exception).equals(true);
    let checkResult = await psqlDriver.processSql('select name from foobar where name=:name', { name: 'toni2-trans' });
    expect(checkResult.table?.length === 0).equals(true);
    checkResult = await psqlDriver.processSql('select name from foobar where name=:name', { name: 'hans-trans' });
    expect(checkResult.table?.length === 1).equals(true);
  });
});
