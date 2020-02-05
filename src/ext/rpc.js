/* global sauce, browser */

(function() {
    'use strict';

    const hooks = {};


    function addHook(system, op, callback) {
        const sysTable = hooks[system] || (hooks[system] = {});
        sysTable[op] = callback;
    }


    function _getI18nMessage(args) {
        try {
            return browser.i18n.getMessage.apply(null, args);
        } catch(e) {
            console.warn(`Failed to get i18n message for: ${args[0]}: ${e.message}`);
        }
    }


    addHook('storage', 'set', sauce.storage.set);
    addHook('storage', 'get', sauce.storage.get);
    addHook('ga', 'apply', async function({args, meta}) {
        let tracker = await sauce.ga.getTracker(this.tab.id);
        const url = new URL(this.url);
        if (!tracker) {
            tracker = await sauce.ga.createTracker(this.tab.id);
            tracker.set('hostname', url.hostname);
        }
        tracker.set('referrer', meta.referrer);
        tracker.set('location', url.href.split('#')[0]);
        tracker.set('viewportSize', `${this.tab.width}x${this.tab.height}`);
        const method = args.shift();
        tracker[method].apply(tracker, args);
    });
    addHook('app', 'getDetails', () => browser.app.getDetails());
    addHook('locale', 'getMessage', _getI18nMessage);
    addHook('locale', 'getMessages', batch => batch.map(x => _getI18nMessage(x)));


    async function onMessage(msg, sender) {
        const hook = hooks[msg.system][msg.op];
        return await hook.call(sender, msg.data);
    }

    browser.runtime.onMessageExternal.addListener(onMessage);
    browser.runtime.onMessage.addListener(onMessage);
})();