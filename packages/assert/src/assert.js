/* global globalThis */
// Copyright (C) 2019 Agoric, under Apache License 2.0

// @ts-check

import './types';

const assert = globalThis.assert;

const { details, quote } = assert;
export { assert, details, quote, quote as q };
