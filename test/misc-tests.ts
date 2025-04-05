// noinspection SqlResolve
/* tslint:disable:no-console */

import { expect } from 'chai';
import { exceptionResult } from '../src';

describe('Misc Tests', () => {
  // before(() => {}); // the tests container
  it('utils', () => {
    expect(!!exceptionResult('')).equals(true);
  });
});
