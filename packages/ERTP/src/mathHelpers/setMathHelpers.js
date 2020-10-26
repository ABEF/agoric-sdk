// @ts-check

import { passStyleOf } from '@agoric/marshal';
import { assert, details as d, q } from '@agoric/assert';
import { sameStructure, patternKindOf } from '@agoric/same-structure';

import '../types';

// Operations for arrays with unique objects identifying and providing
// information about digital assets. Used for Zoe invites.
const identity = harden([]);

// Cut down the number of sameStructure comparisons to only the ones
// that don't fail basic equality tests
// TODO: better name?
const hashBadly = record => {
  const keys = Object.getOwnPropertyNames(record);
  keys.sort();
  const values = Object.values(record).filter(
    value => typeof value === 'string',
  );
  values.sort();
  return [...keys, ...values].join();
};

const makeBuckets = list => {
  const buckets = new Map();
  list.forEach(elem => {
    const badHash = hashBadly(elem);
    if (!buckets.has(badHash)) {
      buckets.set(badHash, []);
    }
    const soFar = buckets.get(badHash);
    soFar.push(elem);
  });
  return buckets;
};

// Based on bucket sort
const checkForDupes = buckets => {
  for (const maybeMatches of buckets.values()) {
    for (let i = 0; i < maybeMatches.length; i += 1) {
      for (let j = i + 1; j < maybeMatches.length; j += 1) {
        assert(
          !sameStructure(maybeMatches[i], maybeMatches[j]),
          d`value has duplicates: ${maybeMatches[i]} and ${maybeMatches[j]}`,
        );
      }
    }
  }
};

const hasElement = (buckets, elem) => {
  const badHash = hashBadly(elem);
  if (!buckets.has(badHash)) {
    return false;
  }
  const maybeMatches = buckets.get(badHash);
  return maybeMatches.some(maybeMatch => sameStructure(maybeMatch, elem));
};

// get a string of string keys and string values as a fuzzy hash for
// bucketing.
// only use sameStructure within that bucket.

/**
 * @type {MathHelpers}
 */
const setMathHelpers = harden({
  doCoerce: list => {
    assert(passStyleOf(list) === 'copyArray', 'list must be an array');
    checkForDupes(makeBuckets(list));
    return list;
  },
  doGetEmpty: _ => identity,
  doIsEmpty: list => passStyleOf(list) === 'copyArray' && list.length === 0,
  doIsGTE: (left, right) => {
    const leftBuckets = makeBuckets(left);
    return right.every(rightElem => hasElement(leftBuckets, rightElem));
  },
  doIsEqual: (left, right) => {
    return left.length === right.length && setMathHelpers.doIsGTE(left, right);
  },
  doAdd: (left, right) => {
    const combined = harden([...left, ...right]);
    checkForDupes(makeBuckets(combined));
    return combined;
  },
  doSubtract: (left, right) => {
    const leftBuckets = makeBuckets(left);
    const rightBuckets = makeBuckets(right);
    right.forEach(rightElem => {
      assert(
        hasElement(leftBuckets, rightElem),
        d`right element ${rightElem} was not in left`,
      );
    });
    const leftElemNotInRight = leftElem => !hasElement(rightBuckets, leftElem);
    return harden(left.filter(leftElemNotInRight));
  },

  // TODO Reform awful code!
  // Expanded this in place this way only as part of an expedient
  // spike. It is indeed a horrible clump of code that must be broken up.
  doFrugalSplit: (pattern, specimen) => {
    const patternKind = patternKindOf(pattern);
    if (patternKind === undefined) {
      const specimenBuckets = makeBuckets(specimen);
      const patternBuckets = makeBuckets(pattern);
      const remove = subPattern => {
        // TODO Use pattern match
        return hasElement(specimenBuckets, subPattern);
      };
      if (!pattern.every(remove)) {
        return undefined;
      }
      const elemNotInPattern = elem => {
        // TODO Use pattern match
        return !hasElement(patternBuckets, elem);
      };
      const change = harden(specimen.filter(elemNotInPattern));
      return harden({
        matched: setMathHelpers.doSubtract(specimen, change),
        change,
      });
    }
    switch (patternKind) {
      case '*': {
        return harden({
          matched: identity,
          change: specimen,
        });
      }
      default: {
        throw assert.fail(d`Unexpected patternKind ${q(patternKind)}`);
      }
    }
  },
});

harden(setMathHelpers);
export default setMathHelpers;
