/* global sauce */

(function () {
    "use strict";

    self.sauce = self.sauce || {};
    const ns = self.sauce.patron = {};

    
    async function sha256(input) {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.map(x => x.toString(16).padStart(2, '0')).join('');
    }


    async function fetchLevel(athleteId) {
        const resp = await fetch('https://saucellc.io/patrons.json');
        const fullPatrons = await resp.json();
        const hash = await sha256(athleteId);
        let exp;
        let patronLevel;
        if (fullPatrons[hash]) {
            patronLevel = fullPatrons[hash].level;
            exp = Date.now() + (7 * 86400 * 1000);
        } else {
            patronLevel = 0;
            exp = Date.now() + (3600 * 1000);
        }
        sauce.storage.set({patronLevel});  // bg okay (only for ext pages)
        localStorage.setItem(`sp-${athleteId}`, JSON.stringify([exp, patronLevel]));
        return patronLevel;
    }


    ns.getLevel = function() {
        const cookies = new Map(document.cookie.split(/\s*;\s*/).map(x => x.split(/=/)));
        const athleteId = cookies.get('strava_remember_id');
        const sp = localStorage.getItem(`sp-${athleteId}`);
        if (sp) {
            const [exp, level] = JSON.parse(sp);
            if (exp > Date.now()) {
                // cache hit
                return level;
            }
        }
        return fetchLevel(athleteId);
    };

})();
