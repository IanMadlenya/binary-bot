import { translate } from '../../../common/i18n';
import { recoverFromError, doUntilDone } from '../tools';
import { notify } from '../broadcast';
import { DURING_PURCHASE } from './state/constants';

let delayIndex = 0;

export default Engine => class Sell extends Engine {
    isSellAtMarketAvailable() {
        return this.contractId && !this.isSold && this.isSellAvailable && !this.isExpired;
    }
    sellAtMarket() {
        // Prevent calling sell twice
        if (this.store.getState().scope !== DURING_PURCHASE) {
            return Promise.resolve();
        }

        if (!this.isSellAtMarketAvailable()) {
            throw translate('Sell is not available');
        }

        return recoverFromError(
            () => Promise.all([this.api.sellContract(this.contractId, 0), this.waitForAfter()]),
            (errorCode, makeDelay) => makeDelay().then(() => this.observer.emit('REVERT', 'during')),
            ['NoOpenPosition', 'InvalidSellContractProposal', 'UnrecognisedRequest'],
            delayIndex++
        ).then(s => {
            const { sell: { sold_for: soldFor } } = s[0];
            delayIndex = 0;
            notify('info', `${translate('Sold for')}: ${soldFor}`);
        });
    }
    sellExpired() {
        if (this.isSellAvailable && this.isExpired) {
            doUntilDone(() => this.api.sellExpiredContracts());
        }
    }
};
