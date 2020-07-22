// @ts-check

import { E, HandledPromise } from '@agoric/eventual-send';
import makeWeakStore from '@agoric/weak-store';
import makeIssuerKit from '@agoric/ertp';
import { assert, details } from '@agoric/assert';
import { produceNotifier } from '@agoric/notifier';
import { producePromise } from '@agoric/produce-promise';

/**
 * Zoe uses ERTP, the Electronic Rights Transfer Protocol
 */
import '@agoric/ertp/exported';

import { cleanProposal, cleanKeywords } from './cleanProposal';
import { arrayToObj, filterFillAmounts, filterObj } from './objArrayConversion';
import { makeZoeTables } from './state';

// This is the Zoe contract facet from contractFacet.js, packaged as a bundle
// that can be used to create a new vat. Every time it is edited, it must be
// manually rebuilt with `yarn build-zcfBundle`.  This happens automatically
// on `yarn build` or `yarn test`.

// Do the dance necessary to allow a non-existing bundle to pass both lint and ts.
/* eslint-disable import/no-unresolved, import/extensions */
// @ts-ignore
import zcfContractBundle from '../bundles/bundle-contractFacet';
/* eslint-enable import/no-unresolved, import/extensions */

/**
 * @typedef {TODO} ContractFacet FIXME: Need definition, and move to types.js.
 */

/**
 * Create an instance of Zoe.
 *
 * @param {Object} vatAdminSvc - The vatAdmin Service, which carries the power
 * to create a new vat.
 * @param {Object.<string,any>} [_additionalEndowments] pure or pure-ish
 * endowments to add to evaluator
 * @param {Object.<string,any>} [_vatPowers] provide 'setMeter' and
 * 'transformMetering' (from the vat's buildRoot invocation) to enable
 * within-vat metering of contract code
 * @returns {ZoeService} The created Zoe service.
 */
function makeZoe(vatAdminSvc, _additionalEndowments = {}, _vatPowers = {}) {
  /**
   * A weakMap from the inviteHandles to contract offerHook upcalls
   * @type {import('@agoric/weak-store').WeakStore<InviteHandle,OfferHook>}
   */
  const inviteHandleToCallback = makeWeakStore('inviteHandle');

  const {
    mint: inviteMint,
    issuer: inviteIssuer,
    amountMath: inviteAmountMath,
  } = makeIssuerKit('zoeInvite', 'set');

  // All of the Zoe state is stored in these tables built on WeakMaps
  const {
    installationTable,
    instanceTable,
    offerTable,
    payoutMap,
    issuerTable,
  } = makeZoeTables();

  const getAmountMathForBrand = brand => issuerTable.get(brand).amountMath;

  /**
   * @param {InstanceHandle} instanceHandle
   * @param {Iterable<OfferHandle>} offerHandles
   */
  const completeOffers = (instanceHandle, offerHandles) => {
    const { inactive } = offerTable.getOfferStatuses(offerHandles);
    if (inactive.length > 0) {
      throw new Error(`offer has already completed`);
    }
    const offerRecords = offerTable.getOffers(offerHandles);

    // Remove the offers from the offerTable so that they are no longer active.
    offerTable.deleteOffers(offerHandles);

    // Resolve the payout promises with promises for the payouts
    for (const offerRecord of offerRecords) {
      /** @type {PaymentPKeywordRecord} */
      const payout = {};
      Object.keys(offerRecord.currentAllocation).forEach(keyword => {
        const payoutAmount = offerRecord.currentAllocation[keyword];
        const { purse } = issuerTable.get(payoutAmount.brand);
        payout[keyword] = E(purse).withdraw(payoutAmount);
      });
      harden(payout);
      payoutMap.get(offerRecord.handle).resolve(payout);
    }

    // Remove the offers from the instanceTable now that they've been completed.
    instanceTable.removeCompletedOffers(instanceHandle, offerHandles);
  };

  const removeAmountsAndNotifier = offerRecord =>
    filterObj(offerRecord, ['handle', 'instanceHandle', 'proposal']);

  const doGetCurrentAllocation = (offerHandle, brandKeywordRecord) => {
    const { currentAllocation } = offerTable.get(offerHandle);
    if (brandKeywordRecord === undefined) {
      return currentAllocation;
    }
    /** @type {AmountMathKeywordRecord} */
    const amountMathKeywordRecord = {};
    Object.getOwnPropertyNames(brandKeywordRecord).forEach(keyword => {
      const brand = brandKeywordRecord[keyword];
      amountMathKeywordRecord[keyword] = issuerTable.get(brand).amountMath;
    });
    return filterFillAmounts(currentAllocation, amountMathKeywordRecord);
  };

  const doGetCurrentAllocations = (offerHandles, brandKeywordRecords) => {
    if (brandKeywordRecords === undefined) {
      return offerHandles.map(offerHandle =>
        doGetCurrentAllocation(offerHandle),
      );
    }
    return offerHandles.map((offerHandle, i) =>
      doGetCurrentAllocation(offerHandle, brandKeywordRecords[i]),
    );
  };

  /**
   * Make a Zoe invite payment with an value that is a mix of credible
   * information from Zoe (the `handle` and `instanceHandle`) and
   * other information defined by the smart contract (the mandatory
   * `inviteDesc` and the optional `options.customProperties`).
   * Note that the smart contract cannot override or change the values
   * of `handle` and `instanceHandle`.
   *
   * @param {InstanceHandle} instanceHandle
   * @param {OfferHook} offerHook
   * @param {Object} options
   */
  const makeInvitation = (
    instanceHandle,
    offerHook,
    inviteDesc,
    options = harden({}),
  ) => {
    assert.typeof(
      inviteDesc,
      'string',
      details`expected an inviteDesc string: ${inviteDesc}`,
    );

    const { customProperties = harden({}) } = options;
    const inviteHandle = harden({});
    const { installationHandle } = instanceTable.get(instanceHandle);
    const inviteAmount = inviteAmountMath.make(
      harden([
        {
          ...customProperties,
          inviteDesc,
          handle: inviteHandle,
          instanceHandle,
          installationHandle,
        },
      ]),
    );
    inviteHandleToCallback.init(inviteHandle, offerHook);
    return inviteMint.mintPayment(inviteAmount);
  };

  /**
   * drop zcfForZoe, offerHandles, adminNode.
   * @type {(record: any) => InstanceRecord}
   */
  const filterInstanceRecord = record =>
    filterObj(record, [
      'handle',
      'installationHandle',
      'publicAPI',
      'terms',
      'issuerKeywordRecord',
      'brandKeywordRecord',
    ]);

  const makeZoeForZcf = (instanceHandle, publicApiP) => {
    return harden({
      makeInvitation: (offerHook, inviteDesc, options = undefined) =>
        makeInvitation(instanceHandle, offerHook, inviteDesc, options),
      updateAmounts: (offerHandles, reallocations) =>
        offerTable.updateAmounts(offerHandles, reallocations),
      updatePublicAPI: publicAPI => {
        publicApiP.resolve(publicAPI);
        return instanceTable.update(instanceHandle, { publicAPI });
      },
      addNewIssuer: (issuerP, keyword) =>
        issuerTable.getPromiseForIssuerRecord(issuerP).then(issuerRecord => {
          const { issuerKeywordRecord, brandKeywordRecord } = instanceTable.get(
            instanceHandle,
          );
          const newIssuerKeywordRecord = {
            ...issuerKeywordRecord,
            [keyword]: issuerRecord.issuer,
          };
          const newBrandKeywordRecord = {
            ...brandKeywordRecord,
            [keyword]: issuerRecord.brand,
          };
          instanceTable.update(instanceHandle, {
            issuerKeywordRecord: newIssuerKeywordRecord,
            brandKeywordRecord: newBrandKeywordRecord,
          });
        }),
      completeOffers: offerHandles =>
        completeOffers(instanceHandle, offerHandles),
    });
  };

  // The public Zoe service has four main methods: `install` takes
  // contract code and registers it with Zoe associated with an
  // `installationHandle` for identification, `makeInstance` creates
  // an instance from an installation, `getInstanceRecord` credibly
  // retrieves an instance from Zoe, and `offer` allows users to
  // securely escrow and get in return a record containing a promise for
  // payouts, a promise for the outcome of joining the contract,
  // and, depending on the exit conditions, perhaps a completeObj,
  // an object with a complete method for leaving the contract on demand.

  /** @type {ZoeService} */
  const zoeService = harden({
    getInviteIssuer: () => inviteIssuer,

    /**
     * Create an installation by permanently storing the bundle. It will be
     * evaluated each time it is used to make a new instance of a contract.
     * We have a moduleFormat to allow for different future formats without
     * silent failures.
     */
    install: async bundle => {
      const installationHandle = harden({});
      installationTable.create(harden({ bundle }), installationHandle);
      return installationHandle;
    },

    /**
     * Makes a contract instance from an installation and returns the
     * invitation and InstanceRecord.
     *
     * @param  {object} installationHandle - the unique handle for the
     * installation
     * @param {Object.<string,Issuer>} issuerKeywordRecord - a record mapping
     * keyword keys to issuer values
     * @param  {object} terms - optional, arguments to the contract. These
     * arguments depend on the contract.
     * @returns {Promise<MakeInstanceResult>}
     */
    makeInstance: (
      installationHandle,
      issuerKeywordRecord = harden({}),
      terms = harden({}),
    ) => {
      const publicApiP = producePromise();
      return E(vatAdminSvc)
        .createVat(zcfContractBundle)
        .then(({ root: zcfRoot, adminNode }) => {
          assert(
            installationTable.has(installationHandle),
            details`${installationHandle} was not a valid installationHandle`,
          );

          const instanceHandle = harden({});
          const zoeForZcf = makeZoeForZcf(instanceHandle, publicApiP);

          const cleanedKeywords = cleanKeywords(issuerKeywordRecord);
          const issuersP = cleanedKeywords.map(
            keyword => issuerKeywordRecord[keyword],
          );

          const cleanupOnTermination = () => {
            const { offerHandles } = instanceTable.get(instanceHandle);
            // This cleanup can't rely on ZCF to complete the offers since
            // it's invoked when ZCF is no longer accessible.
            completeOffers(instanceHandle, offerHandles);
          };
          E(adminNode)
            .done()
            .then(() => cleanupOnTermination)
            .catch(() => cleanupOnTermination);

          // Build an entry for the instanceTable. It will contain zcfForZoe
          // which isn't available until ZCF starts. When ZCF starts up, it
          // will invoke the contract, which might make calls back to the Zoe
          // facet we provide, so InstanceRecord needs to be present by then.
          // We'll store an initial version of InstanceRecord before invoking
          // ZCF and fill in the zcfForZoe when we get it.
          const zcfForZoePromise = producePromise();
          /** @type {InstanceRecord} */
          const instanceRecord = {
            installationHandle,
            publicAPI: publicApiP.promise,
            terms,
            issuerKeywordRecord: {},
            brandKeywordRecord: {},
            zcfForZoe: zcfForZoePromise.promise,
            offerHandles: new Set(),
          };
          const addIssuersToInstanceRecord = issuerRecords => {
            const issuers = issuerRecords.map(record => record.issuer);
            const cleanedIssuerKeywordRecord = arrayToObj(
              issuers,
              cleanedKeywords,
            );
            instanceRecord.issuerKeywordRecord = cleanedIssuerKeywordRecord;
            const brands = issuerRecords.map(record => record.brand);
            const brandKeywordRecord = arrayToObj(brands, cleanedKeywords);
            instanceRecord.brandKeywordRecord = brandKeywordRecord;
            instanceTable.create(instanceRecord, instanceHandle);
          };

          const callStartContract = () => {
            const instanceData = harden({
              installationHandle,
              instanceHandle,
              terms,
              adminNode,
            });
            return E(zcfRoot).startContract(
              zoeService,
              issuerKeywordRecord,
              installationTable.get(installationHandle).bundle,
              instanceData,
              zoeForZcf,
              inviteIssuer,
            );
          };

          const finishContractInstall = ({ inviteP, zcfForZoe }) => {
            zcfForZoePromise.resolve(zcfForZoe);
            instanceTable.update(instanceHandle, { zcfForZoe });
            return inviteIssuer.isLive(inviteP).then(success => {
              assert(
                success,
                details`invites must be issued by the inviteIssuer.`,
              );
              return inviteP.then(invite => {
                return {
                  invite,
                  instanceRecord: filterInstanceRecord(
                    instanceTable.get(instanceHandle),
                  ),
                };
              });
            });
          };

          // The issuers may not have been seen before, so we must wait for the
          // issuer records to be available synchronously
          return issuerTable
            .getPromiseForIssuerRecords(issuersP)
            .then(addIssuersToInstanceRecord)
            .then(callStartContract)
            .then(finishContractInstall);
        });
    },

    /**
     * Credibly retrieves an instance record given an instanceHandle.
     * @param {InstanceHandle} instanceHandle - the unique, unforgeable
     * identifier (empty object) for the instance
     */
    getInstanceRecord: instanceHandle =>
      filterInstanceRecord(instanceTable.get(instanceHandle)),

    /** Get a notifier (see @agoric/notify) for the offer. */
    getOfferNotifier: offerHandle => offerTable.get(offerHandle).notifier,

    /**
     * Redeem the invite to receive a payout promise and an
     * outcome promise.
     * @param {Invite} invite - an invite (ERTP payment) to join a
     * Zoe smart contract instance
     * @param  {Proposal} [proposal={}] - the proposal, a record
     * with properties `want`, `give`, and `exit`. The keys of
     * `want` and `give` are keywords and the values are amounts.
     * @param  {Object.<string,Payment>} [paymentKeywordRecord={}] - a record with
     * keyword keys and values which are payments that will be escrowed by
     * Zoe.
     * @returns OfferResultRecord
     *
     * The default arguments allow remote invocations to specify empty
     * objects. Otherwise, explicitly-provided empty objects would be
     * marshaled as presences.
     */
    offer: (
      invite,
      proposal = harden({}),
      paymentKeywordRecord = harden({}),
    ) => {
      return inviteIssuer.burn(invite).then(inviteAmount => {
        assert(
          inviteAmount.value.length === 1,
          'only one invite should be redeemed',
        );
        const giveKeywords = proposal.give
          ? Object.getOwnPropertyNames(proposal.give)
          : [];
        const wantKeywords = proposal.want
          ? Object.getOwnPropertyNames(proposal.want)
          : [];
        const userKeywords = harden([...giveKeywords, ...wantKeywords]);

        const cleanedProposal = cleanProposal(getAmountMathForBrand, proposal);

        const paymentDepositedPs = userKeywords.map(keyword => {
          if (giveKeywords.includes(keyword)) {
            // We cannot trust the amount in the proposal, so we use our
            // cleaned proposal's amount that should be the same.
            const giveAmount = cleanedProposal.give[keyword];
            const { purse } = issuerTable.get(giveAmount.brand);
            return E(purse).deposit(paymentKeywordRecord[keyword], giveAmount);
            // eslint-disable-next-line no-else-return
          } else {
            // payments outside the give: clause are ignored.
            return getAmountMathForBrand(
              cleanedProposal.want[keyword].brand,
            ).getEmpty();
          }
        });

        const {
          value: [{ instanceHandle, handle: inviteHandle }],
        } = inviteAmount;
        const offerHandle = harden({});

        // recordOffer() creates and stores a record in the offerTable. The
        // allocations are according to the keywords in the offer's proposal,
        // which are not required to match anything in the issuerKeywordRecord
        // that was used to instantiate the contract. recordOffer() is called
        // on amountsArray, which includes amounts for all the keywords in the
        // proposal. Keywords in the give clause are mapped to the amount
        // deposited. Keywords in the want clause are mapped to the empty
        // amount for that keyword's Issuer.
        const recordOffer = amountsArray => {
          const notifierRec = produceNotifier();
          const offerRecord = {
            instanceHandle,
            proposal: cleanedProposal,
            currentAllocation: arrayToObj(amountsArray, userKeywords),
            notifier: notifierRec.notifier,
            updater: notifierRec.updater,
          };
          const { zcfForZoe } = instanceTable.get(instanceHandle);
          return E(zcfForZoe)
            .addOffer(
              offerHandle,
              cleanedProposal,
              offerRecord.currentAllocation,
            )
            .then(completeObj => {
              payoutMap.init(offerHandle, producePromise());
              offerTable.create(offerRecord, offerHandle);
              instanceTable.addOffer(instanceHandle, offerHandle);
              return completeObj;
            });
        };

        const makeOfferResult = completeObj => {
          const seatCallback = inviteHandleToCallback.get(inviteHandle);
          const outcomeP = E(seatCallback)(offerHandle);
          const offerResult = {
            offerHandle: HandledPromise.resolve(offerHandle),
            payout: payoutMap.get(offerHandle).promise,
            outcome: outcomeP,
            completeObj,
          };
          return harden(offerResult);
        };
        return Promise.all(paymentDepositedPs)
          .then(recordOffer)
          .then(makeOfferResult);
      });
    },

    isOfferActive: offerTable.isOfferActive,
    getOffers: offerHandles =>
      offerTable.getOffers(offerHandles).map(removeAmountsAndNotifier),
    getOffer: offerHandle =>
      removeAmountsAndNotifier(offerTable.get(offerHandle)),
    getCurrentAllocation: (offerHandle, brandKeywordRecord) =>
      doGetCurrentAllocation(offerHandle, brandKeywordRecord),
    getCurrentAllocations: (offerHandles, brandKeywordRecords) =>
      doGetCurrentAllocations(offerHandles, brandKeywordRecords),
    getInstallation: installationHandle =>
      installationTable.get(installationHandle).bundle,
  });

  return zoeService;
}

export { makeZoe };
