/* global Strava sauce jQuery pageView _ currentAthlete */

sauce.ns('dashboard', function(ns) {

    function filterFeed() {
        const feed = document.querySelector('.main .feed-container .feed');
        let resetFeedLoader = false;
        if (ns.options['activity-hide-promotions']) {
            for (const card of feed.querySelectorAll('.card.promo:not(.hidden-by-sauce)')) {
                console.info("SAUCE: Hiding promo card:", card.id);
                sauce.rpc.reportEvent('ActivityFeed', 'hide', 'promo-card');
                card.classList.add('hidden-by-sauce');
                resetFeedLoader = true;
            }
        }
        if (ns.options['activity-hide-virtual']) {
            for (const card of feed.querySelectorAll('.card:not(.hidden-by-sauce)')) {
                if (!card.querySelector(`.entry-owner[href="/athletes/${currentAthlete.id}"]`) &&
                    card.querySelector(`[class^="icon-virtual"], [class*=" icon-virtual"]`)) {
                    console.info("SAUCE: Hiding Virtual Activity:", card.id || 'group activity');
                    sauce.rpc.reportEvent('ActivityFeed', 'hide', 'virtual-activity');
                    card.classList.add('hidden-by-sauce');
                    resetFeedLoader = true;
                }
            }
        }
        if (ns.options['activity-hide-challenges']) {
            for (const card of feed.querySelectorAll('.card.challenge:not(.hidden-by-sauce)')) {
                console.info("SAUCE: Hiding challenge card:", card.id);
                sauce.rpc.reportEvent('ActivityFeed', 'hide', 'challenge-card');
                card.classList.add('hidden-by-sauce');
                resetFeedLoader = true;
            }
        }
        if (ns.options['activity-chronological']) {
            console.info("SAUCE: Ordering feed chronologically");
            sauce.rpc.reportEvent('ActivityFeed', 'sort-feed', 'chronologically');
            resetFeedLoader = true;
            let lastTimestamp;
            for (const card of feed.querySelectorAll('.card')) {
                if (!card.dataset.updatedAt && lastTimestamp) {
                    lastTimestamp += 1;
                } else {
                    lastTimestamp = card.dataset.updatedAt;
                }
                card.style.order = -Number(card.dataset.updatedAt);
            }
        }
        if (resetFeedLoader) {
            requestAnimationFrame(() => Strava.Dashboard.PaginationRouterFactory.view.resetFeedLoader());
        }
    }

    async function load() {
        await sauce.rpc.ga('set', 'page', `/site/dashboard`);
        await sauce.rpc.ga('set', 'title', 'Sauce Dashboard');
        await sauce.rpc.ga('send', 'pageview');
        ns.options = await sauce.rpc.storageGet('options');
        const feedMutationObserver = new MutationObserver(_.debounce(filterFeed, 200));
        feedMutationObserver.observe(document.querySelector('.main .feed-container .feed'), {
            childList: true,
            attributes: false,
            characterData: false,
            subtree: false,
        });
        filterFeed();
    }

    return {
        load,
    };
});


(async function() {
    if (window.location.pathname.startsWith('/dashboard')) {
        try {
            await sauce.dashboard.load();
        } catch(e) {
            await sauce.rpc.reportError(e);
        }
    }
})();