import harden from '@agoric/harden';

function build(E, log) {
  let resolver;
  let carol;
  return harden({
    first(carolVat) {
      log('=> Bob: in first');
      const answer = new Promise((theResolver, _theRejector) => {
        resolver = theResolver;
      });
      carol = carolVat;
      return answer;
    },
    second(p) {
      log('=> Bob: second begins');
      resolver('Bob answers first in second');
      log('=> Bob: send p to carol.foo');
      E(carol).foo(p);
      p.then(
        r => log(`=> Bob: the parameter to second resolved to '${r}'`),
        e => log(`=> Bob: the parameter to second rejected as '${e}'`),
      );
      Promise.resolve().then(E(carol).bar(p));
      log('=> Bob: second done');
      return `Bob's second answer`;
    },
  });
}

export default function setup(syscall, state, helpers) {
  function log(what) {
    helpers.log(what);
    console.log(what);
  }
  return helpers.makeLiveSlots(
    syscall,
    state,
    E => build(E, log),
    helpers.vatID,
  );
}
