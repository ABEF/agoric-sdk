/* global assert */

// @ts-check

import { importBundle } from '@agoric/import-bundle';
// import { assert } from '@agoric/assert';

const evalContractBundle = (bundle, additionalEndowments = {}) => {
  const defaultEndowments = {
    console,
    assert,
  };

  const fullEndowments = Object.create(null, {
    ...Object.getOwnPropertyDescriptors(defaultEndowments),
    ...Object.getOwnPropertyDescriptors(additionalEndowments),
  });

  // Evaluate the export function, and use the resulting
  // module namespace as our installation.

  const installation = importBundle(bundle, {
    endowments: fullEndowments,
  });
  // Don't trigger Node.js's UnhandledPromiseRejectionWarning
  installation.catch(() => {});
  return installation;
};

export { evalContractBundle };
