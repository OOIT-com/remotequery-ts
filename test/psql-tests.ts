// tslint:disable:no-console

import { expect } from 'chai';
import { PSQLDriver } from '../src';

const user = 'postgres';
const password = 'postgres';
const host = 'localhost';
const database = '';
const port = 5432;

describe('PSQL Tests', () => {
  let psqlDriver: PSQLDriver | undefined;

  before(() => {
    psqlDriver = new PSQLDriver({ user, password, host, database, port, ssl: undefined });
  });

  after(async () => {
    if (psqlDriver) {
      await psqlDriver.processSqlDirect('delete from foobar where age > 2');
      await psqlDriver.destroy();
    }
  });

  it('directory sqls', async () => {
    const con = await psqlDriver?.getConnection();
    expect(!!con).equals(true);
  });
  // it('create database and table', async () => {
  //   if (!psqlDriver) {
  //     expect.fail('PSQLDriver not initialized!');
  //     return;
  //   }
  //   const con = await psqlDriver.getConnection();
  //   expect(!!con).equals(true);
  //   try {
  //     await psqlDriver.processSqlDirect('create table foobar(name varchar(200),age bigint)');
  //   } catch (error) {
  //     console.error('Error creating database:', error);
  //   }
  // });

  it('inserts with directly', async () => {
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
      return;
    }
    const con = await psqlDriver.getConnection();
    if (con) {
      try {
        await con.query("insert into foobar(name, age) values ('hans', 4)");
        const queryResult = await con.query('select * from foobar');
        if (queryResult.rowCount) {
          console.log(queryResult.rows);
        }
      } catch (e) {
        console.error('Error creating database:', e);
      }
    }
  });
  it('inserts with driver', async () => {
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
    }
    const con = await psqlDriver.getConnection();
    expect(!!con).equals(true);
    try {
      await psqlDriver.processSql('insert into foobar(name, age) values (:name, :age)', { name: 'toni', age: 23 });
    } catch (error) {
      console.error('Error creating database:', error);
    }
  });

  it('inserts with driver and transaction', async () => {
    if (!psqlDriver) {
      expect.fail('PSQLDriver not initialized!');
    }
    const txId = await psqlDriver.startTransaction();

    try {
      await psqlDriver.processSql(
        'insert into foobar(name, age) values (:name, :age)',
        {
          name: 'toni-trans',
          age: 23
        },
        { txId }
      );

      await psqlDriver.processSql(
        'insert into foobar(name, age) values (:name, :age)',
        {
          name: 'hans-trans',
          age: 23
        },
        { txId }
      );
    } catch (e) {
      console.log(`${e}`);
      psqlDriver.rollbackTransaction(txId);
    } finally {
      psqlDriver.commitTransaction(txId);
    }
  });
});
