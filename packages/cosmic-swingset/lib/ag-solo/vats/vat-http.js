import harden from '@agoric/harden';
// Avoid importing the full captp bundle, which would carry
// in its own makeHardener, etc.
import { makeCapTP } from '@agoric/captp/lib/captp';

import { getReplHandler } from './repl';

// This vat contains the HTTP request handler.
function build(E, D) {
  let commandDevice;
  let provisioner;
  const loaded = {};
  loaded.p = new Promise((resolve, reject) => {
    loaded.res = resolve;
    loaded.rej = reject;
  });
  harden(loaded);
  const homeObjects = { LOADING: loaded.p };
  let isReady = false;
  const readyForClient = {};
  let exportedToCapTP = {
    LOADING: loaded.p,
    READY: {
      resolve(value) {
        isReady = true;
        readyForClient.res(value);
      },
      isReady() {
        return isReady;
      },
    },
  };

  readyForClient.p = new Promise((resolve, reject) => {
    readyForClient.res = resolve;
    readyForClient.rej = reject;
  });
  harden(readyForClient);

  const handler = {};
  const registeredURLHandlers = new Map();

  // TODO: Don't leak memory.
  async function registerURLHandler(newHandler, url) {
    const commandHandler = await E(newHandler).getCommandHandler();
    let reg = registeredURLHandlers.get(url);
    if (!reg) {
      reg = [];
      registeredURLHandlers.set(url, reg);
    }
    reg.push(commandHandler);
  }

  return {
    setCommandDevice(d, ROLES) {
      commandDevice = d;
      if (ROLES.client) {
        const conns = new Map();
        const forward = method => obj => {
          const dispatchAbort = conns.get(obj.connectionID);
          if (!dispatchAbort || !(1, dispatchAbort[0])(obj)) {
            console.log(
              `Could not find CapTP handler ${method}`,
              obj.connectionID,
            );
            return undefined;
          }
          return true;
        };
        Object.assign(
          handler,
          getReplHandler(E, homeObjects, msg =>
            D(commandDevice).sendBroadcast(msg),
          ),
          {
            readyForClient() {
              return readyForClient.p;
            },
          },
          {
            CTP_OPEN(obj) {
              console.log(`Starting CapTP`, obj.connectionID);
              const sendObj = o => {
                o.connectionID = obj.connectionID;
                D(commandDevice).sendBroadcast(o);
              };
              const { dispatch, abort } = makeCapTP(
                obj.connectionID,
                sendObj,
                () =>
                  // Harden only our exported objects.
                  harden(exportedToCapTP),
              );
              conns.set(obj.connectionID, [dispatch, abort]);
            },
            CTP_CLOSE(obj) {
              console.log(`Finishing CapTP`, obj.connectionID);
              const dispatchAbort = conns.get(obj.connectionID);
              if (dispatchAbort) {
                (1, dispatchAbort[1])();
              }
              conns.delete(obj.connectionID);
            },
            CTP_ERROR(obj) {
              console.log(`Error in CapTP`, obj.connectionID, obj.error);
            },
            CTP_BOOTSTRAP: forward('CTP_BOOTSTRAP'),
            CTP_CALL: forward('CTP_CALL'),
            CTP_RETURN: forward('CTP_RETURN'),
            CTP_RESOLVE: forward('CTP_RESOLVE'),
          },
        );
      }
      if (ROLES.controller) {
        handler.pleaseProvision = obj => {
          const { nickname, pubkey } = obj;
          // FIXME: There's a race here.  We return from the call
          // before the outbound messages have been committed to
          // a block.  This means the provisioning-server must
          // retry transactions as they might have the wrong sequence
          // number.
          return E(provisioner).pleaseProvision(nickname, pubkey);
        };
        handler.pleaseProvisionMany = obj => {
          const { applies } = obj;
          return Promise.all(
            applies.map(args =>
              // Emulate allSettled.
              E(provisioner)
                .pleaseProvision(...args)
                .then(
                  value => ({ status: 'fulfilled', value }),
                  reason => ({ status: 'rejected', reason }),
                ),
            ),
          );
        };
      }
    },

    registerURLHandler,
    registerAPIHandler: h => registerURLHandler(h, '/api'),

    setProvisioner(p) {
      provisioner = p;
    },

    setPresences(ps, privateObjects) {
      exportedToCapTP = {
        LOADING: loaded.p,
        READY: exportedToCapTP.READY,
        ...ps,
        ...privateObjects,
      };
      Object.assign(homeObjects, ps, privateObjects);
      loaded.res('chain bundle loaded');
      delete homeObjects.LOADING;
    },

    // devices.command invokes our inbound() because we passed to
    // registerInboundHandler()
    async inbound(count, obj) {
      try {
        // console.log(
        //   `vat-http.inbound (from browser) ${count}`,
        //   JSON.stringify(obj, undefined, 2),
        // );

        const { type, requestContext: { url } = { url: '/vat' } } = obj;
        if (url === '/vat' || url === '/captp') {
          // Use our local handler object (compatibility with repl.js).
          // TODO: standardise
          if (handler[type]) {
            D(commandDevice).sendResponse(count, false, handler[type](obj));
            return;
          }
        }

        const urlHandlers = registeredURLHandlers.get(url);
        if (urlHandlers) {
          // todo fixme avoid the loop
          // For now, go from the end to beginning so that handlers
          // override.
          const hardObjects = harden({ ...homeObjects });
          for (let i = urlHandlers.length - 1; i >= 0; i -= 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await E(urlHandlers[i]).processInbound(
              obj,
              hardObjects,
            );
            if (res) {
              D(commandDevice).sendResponse(count, false, harden(res));
              return;
            }
          }
        }

        throw Error(`No handler for ${url} ${type}`);
      } catch (rej) {
        D(commandDevice).sendResponse(count, true, harden(rej));
      }
    },
  };
}

export default function setup(syscall, state, helpers) {
  return helpers.makeLiveSlots(
    syscall,
    state,
    (E, D) => harden(build(E, D)),
    helpers.vatID,
  );
}
