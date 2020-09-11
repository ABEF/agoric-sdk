/**
 * @typedef {Object} SellItemsPublicFacet
 * @property {() => Issuer} getItemsIssuer
 * @property {() => Amount} getAvailableItems
 *
 * @typedef {Object} SellItemsCreatorOnly
 * @property {() => ERef<Invitation>} makeBuyerInvitation
 *
 * @typedef {SellItemsPublicFacet & SellItemsCreatorOnly} SellItemsCreatorFacet
 */

/**
 * @typedef {Object} SellItemsParameters
 * @property {Record<string, any>} customValueProperties
 * @property {number} count
 * @property {Issuer} moneyIssuer
 * @property {Installation} sellItemsInstallation
 * @property {Amount} pricePerItem
 *
 * @typedef {Object} SellItemsResult
 * @property {UserSeat} sellItemsCreatorSeat
 * @property {SellItemsCreatorFacet} sellItemsCreatorFacet
 * @property {Instance} sellItemsInstance
 * @property {SellItemsPublicFacet} sellItemsPublicFacet
 *
 * @typedef {Object} MintAndSellNFTCreatorFacet
 * @property {(sellParams: SellItemsParameters) => Promise<SellItemsResult>} sellTokens
 * @property {() => Issuer} getIssuer
 */

/**
 * @typedef {Object} AutoswapPublicFacet
 * @property {() => ERef<Invitation>} makeSwapInvitation synonym for
 * makeSwapInInvitation
 * @property {() => ERef<Invitation>} makeSwapInInvitation make an invitation
 * that allows one to do a swap in which the In amount is specified and the Out
 * amount is calculated
 * @property {() => ERef<Invitation>} makeSwapOutInvitation make an invitation
 * that allows one to do a swap in which the Out amount is specified and the In
 * amount is calculated
 * @property {() => ERef<Invitation>} makeAddLiquidityInvitation make an
 * invitation that allows one to add liquidity to the pool.
 * @property {() => ERef<Invitation>} makeRemoveLiquidityInvitation make an
 * invitation that allows one to remove liquidity from the pool.
 * @property {() => Issuer} getLiquidityIssuer
 * @property {() => number} getLiquiditySupply get the current value of
 * liquidity held by investors.
 * @property {(amountIn: Amount, brandOut: Brand) => Amount} getInputPrice
 * calculate the amount of brandOut that will be returned if the amountIn is
 * offered using makeSwapInInvitation at the current price.
 * @property {(amountOut: Amount, brandIn: Brand) => Amount} getOutputPrice
 * calculate the amount of brandIn that is required in order to get amountOut
 * using makeSwapOutInvitation at the current price
 * @property {() => Record<string, Amount>} getPoolAllocation get an
 * AmountKeywordRecord showing the current balances in the pool.
 */

/**
 * @typedef {Object} Pool
 * @property {(inputValue: Value) => Amount } getSecondaryToCentralInputPrice
 * @property {(inputValue: Value) => Amount } getCentralToSecondaryInputPrice
 * @property {(inputValue: Value) => Amount } getSecondaryToCentralOutputPrice
 * @property {(inputValue: Value) => Amount } getCentralToSecondaryOutputPrice
 * @property {() => number} getLiquiditySupply
 * @property {(seat: ZCFSeat) => string} addLiquidity
 * @property {(seat: ZCFSeat) => string} removeLiquidity
 * @property {() => ZCFSeat} getPoolSeat
 * @property {() => AmountMath} getAmountMath - get the amountMath for this
 * pool's secondary brand
 * @property {() => AmountMath} getCentralAmountMath
 * @property {() => Amount} getSecondaryAmount
 * @property {() => Amount} getCentralAmount
 */

/**
 * @typedef {Object} MultipoolAutoswapPublicFacet
 * @property {(issuer: Issuer, keyword: Keyword) => Promise<Issuer>} addPool
 * add a new liquidity pool
 * @property {() => ERef<Invitation>} makeSwapInvitation synonym for
 * makeSwapInInvitation
 * @property {() => ERef<Invitation>} makeSwapInInvitation make an invitation
 * that allows one to do a swap in which the In amount is specified and the Out
 * amount is calculated
 * @property {() => ERef<Invitation>} makeSwapOutInvitation make an invitation
 * that allows one to do a swap in which the Out amount is specified and the In
 * amount is calculated
 * @property {() => ERef<Invitation>} makeAddLiquidityInvitation make an
 * invitation that allows one to add liquidity to the pool.
 * @property {() => ERef<Invitation>} makeRemoveLiquidityInvitation make an
 * invitation that allows one to remove liquidity from the pool.
 * @property {() => Issuer} getLiquidityIssuer
 * @property {() => number} getLiquiditySupply get the current value of
 * liquidity held by investors.
 * @property {(amountIn: Amount, brandOut: Brand) => Amount} getInputPrice
 * calculate the amount of brandOut that will be returned if the amountIn is
 * offered using makeSwapInInvitation at the current price.
 * @property {(amountOut: Amount, brandIn: Brand) => Amount} getOutputPrice
 * calculate the amount of brandIn that is required in order to get amountOut
 * using makeSwapOutInvitation at the current price
 * @property {() => Record<string, Amount>} getPoolAllocation get an
 * AmountKeywordRecord showing the current balances in the pool.
 */

/**
 * @typedef {Object} AutomaticRefundPublicFacet
 * @property {() => number} getOffersCount
 * @property {() => ERef<Invitation>} makeInvitation
 */
/**
 * @typedef {Object} SimpleExchangePublicFacet
 * @property {() => ERef<Invitation>} makeInvitation
 * @property {() => Notifier<any>} getNotifier
 */
