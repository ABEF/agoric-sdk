// @ts-check

import { E } from '@agoric/eventual-send';

import makeWeakStore from '@agoric/weak-store';
import makeAmountMath from '@agoric/ertp/src/amountMath';
import { makeTable, makeValidateProperties } from './table';

/**
 * @template K,V
 * @typedef {import('@agoric/weak-store').WeakStore<K,V>} WeakStore
 */

// Issuer Table key: brand
// Columns: issuer | amountMath | brand
//
// The IssuerTable is keyed by brand, but the Issuer is required in order for
// getPromiseForIssuerRecord() to initialize the records. When
// getPromiseForIssuerRecord is called and the record doesn't exist, it stores a
// promise for the record in issuersInProgress, and then builds the record. It
// updates the tables when done.
//
const makeIssuerTable = () => {
  /**
   * TODO: make sure this validate function protects against malicious
   * misshapen objects rather than just a general check.
   * @type {Validator<IssuerRecord & { purse?: Purse }>}
   */
  const validateSomewhat = makeValidateProperties(
    harden(['brand', 'issuer', 'amountMath']),
  );

  const makeCustomMethods = table => {
    /** @type {WeakStore<Issuer,any>} */
    const issuersInProgress = makeWeakStore('issuer');

    /** @type {WeakStore<Issuer,Brand>} */
    const issuerToBrand = makeWeakStore('issuer');

    // We can't be sure we can build the table entry soon enough that the first
    // caller will get the actual data, so we start by saving a promise in the
    // inProgress table, and once we have the Issuer, build the record, fill in
    // the table, and resolve the promise.
    /**
     * @param {Issuer} issuer
     */
    function buildTableEntryAndPlaceHolder(issuer) {
      // remote calls which immediately return a promise
      const mathHelpersNameP = E(issuer).getMathHelpersName();
      const brandP = E(issuer).getBrand();

      /**
       * a promise for a synchronously accessible record
       * @type {[PromiseLike<Brand>, PromiseLike<string>]}
       */
      const promiseArray = [brandP, mathHelpersNameP];
      const synchronousRecordP = Promise.all(promiseArray).then(
        ([brand, mathHelpersName]) => {
          const amountMath = makeAmountMath(brand, mathHelpersName);
          const issuerRecord = {
            brand,
            issuer,
            amountMath,
          };
          table.create(issuerRecord, brand);
          issuerToBrand.init(issuer, brand);
          issuersInProgress.delete(issuer);
          return table.get(brand);
        },
      );
      issuersInProgress.init(issuer, synchronousRecordP);
      return synchronousRecordP;
    }

    const customMethods = harden({
      // `issuerP` may be a promise, presence, or local object. If there's
      // already a record, or already a promise for a record, return it.
      // Otherwise wrap a promise around building the record so we can return
      // the promise until we build the record.
      getPromiseForIssuerRecord: issuerP => {
        return Promise.resolve(issuerP).then(issuer => {
          if (issuerToBrand.has(issuer)) {
            // we always initialize table and issuerToBrand together
            return table.get(issuerToBrand.get(issuer));
            // eslint-disable-next-line no-else-return
          } else if (issuersInProgress.has(issuer)) {
            // a promise which resolves to the issuer record
            return issuersInProgress.get(issuer);
            // eslint-disable-next-line no-else-return
          } else {
            return buildTableEntryAndPlaceHolder(issuer);
          }
        });
      },
      // Synchronous, but throws if not present.
      getIssuerRecordByIssuer: issuer => table.get(issuerToBrand.get(issuer)),
    });
    return customMethods;
  };

  return makeTable(validateSomewhat, 'brand', makeCustomMethods);
};

export { makeIssuerTable };
