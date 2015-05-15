
sauce.ns('analysis', function(ns) {

    var default_ftp = 250;

    /* TODO: Move to user options. */
    var cp_periods = [
        ['5s', 5],
        ['15s', 15],
        ['30s', 30],
        ['1min', 60],
        ['2min', 120],
        ['5min', 300],
        ['10min', 600],
        ['15min', 900],
        ['20min', 1200],
        ['30min', 1800],
        ['1hour', 3600]
    ];

    var onStreamData = function() {
        console.log("Parsing Watts Stream for Critical Power Chart");

        var ctx = this;
        var streams = pageView.streams();
        var watts_stream = streams.getStream('watts');
        if (!watts_stream) {
            watts_stream = streams.getStream('watts_calc');
            if (!watts_stream) {
                console.warn("No power data for this ride.");
            }
            /* Only show large period for watt estimates. */
            var too_small = [];
            cp_periods.forEach(function(x, i) {
                if (x[1] < 300) {
                    too_small.push(i);
                }
            });
            too_small.sort().reverse().forEach(function(i) {
                delete cp_periods[i];
            });
        }

        var np = watts_stream ? sauce.power.calcNP(watts_stream) : undefined;
        var np_val = np && np.value;
        var ts_stream = streams.getStream('time'); 
        var weight_norm;
        var weight_kg = pageView.activityAthleteWeight();
        var weight_unit = ctx.athlete.get('weight_measurement_unit');
        var if_ = np && np_val / ctx.ftp;
        var tpl_data = {
            np: np_val,
            weight_unit: weight_unit,
            weight_norm: (weight_unit == 'lbs') ? weight_kg * 2.20462 : weight_kg,
            ftp: ctx.ftp,
            if_: if_,
            tss: np && sauce.power.calcTSS(np, if_, ctx.ftp)
        };
        var frag = jQuery(ctx.tertiary_stats_tpl(tpl_data));
        var link = frag.find('.provide_ftp');
        var input = link.siblings('input');

        input.keyup(function(ev) {
            if (ev.keyCode != 13) {
                return;
            }
            var val = Number(input.val());
            if (!val || val < 0) {
                jQuery('<div title="Invalid FTP Wattage.">' +
                       '<b>"' + input.val() + '" is not a valid FTP.</b>' +
                       '</div>').dialog({modal: true});
            } else {
                input.hide();
                link.html(val).show();
                jQuery('<div title="Reloading...">' +
                       '<b>Reloading page to reflect FTP change."' +
                       '</div>').dialog({modal: true});
                sauce.comm.setFTP(ctx.athlete.get('id'), val, function() {
                    location.reload();
                });
            }
        });
            
        link.click(function() {
            input.width(link.hide().width()).show();
        });

        frag.insertAfter(jQuery('.inline-stats').last());

        if (watts_stream) {
            cp_periods.forEach(function(period) {
                var cp = sauce.power.critpower(ts_stream, watts_stream, period[1]);
                if (cp !== undefined) {
                    var el = jQuery('#sauce-cp-' + period[1]);
                    el.html(Math.round(cp.avg()));
                    el.parent().click(function(x) {
                        sauce.analysis.moreinfo_dialog.call(ctx, period, cp, weight_kg);
                    });
                    jQuery('#sauce-cp-row-' + period[1]).show();
                }
            });
            jQuery('#sauce-critpower').show();
        }
    };

    var moreinfo_dialog = function(cp_period, cp_roll, weight) {
        var ctx = this;
        var cp_avg = cp_roll.avg();
        var np = sauce.power.calcNP(cp_roll._values);
        var avgpwr = np.value ? np : {value: cp_avg, count: cp_roll._values.length};
        var if_ = avgpwr.value / ctx.ftp;
        var data = {
            title: 'Critical power - ' + cp_period[0],
            start_time: (new Strava.I18n.TimespanFormatter()).display(cp_roll._times[0]),
            w_kg: cp_avg / weight,
            peak_power: Math.max.apply(null, cp_roll._values),
            cp_avg: cp_avg,
            np: np.value,
            tss: sauce.power.calcTSS(avgpwr, if_, ctx.ftp),
            if_: if_
        };

        var frag = jQuery(ctx.moreinfo_tpl(data));
        frag.find('.start_time_link').click(function() {
            pageView.router().changeMenuTo([
                'analysis',
                cp_roll.offt - cp_roll._values.length + cp_roll.padCount(),
                cp_roll.offt
            ].join('/'));
        });

        var dialog = frag.dialog({
            resizable: false,
            modal: false,
            buttons: {
                Close: function() { dialog.dialog('close'); }
            }
        });

        /* Must run after the dialog is open for proper rendering. */
        frag.find('.sauce-sparkline').sparkline(cp_roll._values, {
            type: 'line',
            width: '100%',
            height: 56,
            lineColor: '#EA400D',
            fillColor: 'rgba(234, 64, 13, 0.61)',
            chartRangeMin: 0,
            normalRangeMin: 0,
            normalRangeMax: cp_avg,
            tooltipSuffix: 'w'
        });
    };

    var start = function() {
        console.log('Starting Sauce Activity Analysis');

        jQuery.getScript('https://cdnjs.cloudflare.com/ajax/libs/' +
                         'jquery-sparklines/2.1.2/jquery.sparkline.min.js');

        sauce.func.runBefore(Strava.Labs.Activities.StreamsRequest, 'request', function() {
            this.require('watts');
        });

        /* XXX: Make template like the other stuff. */
        var panel = [
            '<ul id="sauce-critpower" style="display: none;" class="pagenav">',
                '<li class="group">',
                    '<div class="title">Critical Power</div>',
                    '<table>'
        ];

        cp_periods.forEach(function(x) {
            var r = [
                '<tr style="display: none;" id="sauce-cp-row-', x[1], '">',
                    '<td>', x[0], '</td>',
                    '<td>',
                        '<span id="sauce-cp-', x[1], '"></span>',
                        '<attr class="unit">W</attr>',
                    '</td>',
                '</tr>'
            ];
            panel.push(r.join(''));
        });

        panel.push('</table></li></ul>');
        jQuery(panel.join('')).insertBefore('.actions-menu');

        var IfDone = function(callback) {
            this.callback = callback;
            this.refcnt = 0;
        };
        IfDone.prototype.inc = function() {
            this.refcnt++;
            console.info('+REF', this.refcnt);
        };
        IfDone.prototype.dec = function() {
            this.refcnt--;
            console.info('-REF', this.refcnt);
            if (this.refcnt === 0) {
                console.info("RUN:", this.callback);
                this.callback();
            } else {
                console.warn("NO RUN:", this.callback, this);
            }
        };

        var done = new sauce.func.IfDone(function() { onStreamData.call(context); });

        var context = {
            athlete: pageView.activityAthlete(),
            activity: pageView.activity()
        };
        var athlete_id = context.athlete.get('id');

        var tpl_url = sauce.extURL + 'templates/';
        done.inc();
        jQuery.ajax(tpl_url + 'tertiary-stats.html').done(function(data) {
            context.tertiary_stats_tpl = _.template(data);
            done.dec();
        });

        done.inc();
        jQuery.ajax(tpl_url + 'critpower-moreinfo.html').done(function(data) {
            context.moreinfo_tpl = _.template(data);
            done.dec();
        });

        done.inc();
        sauce.comm.getFTP(athlete_id, function(ftp) {
            /* Default to strava ftp value, also warn of differences. */
            var strava_ftp = context.activity.get('ftp');
            if (!ftp) {
                if (strava_ftp) {
                    console.info("Setting FTP override from strava.");
                    ftp = strava_ftp;
                    sauce.comm.setFTP(athlete_id, strava_ftp);
                } else {
                    console.warn("No FTP value found, using default.");
                    ftp = default_ftp;
                }
                sauce.comm.setFTP(athlete_id, ftp);
            } else if (strava_ftp && ftp != strava_ftp) {
                console.warn("Sauce FTP override differs from Strava FTP:",
                             ftp, strava_ftp);
                jQuery('<div title="WARNING: FTP Mismatch">' +
                       'Your Sauce FTP override value of ' + ftp + ' differs from ' +
                       'your Strava FTP setting of ' + strava_ftp + '. Generally ' +
                       'these should match.<br/><br/>' +
                       '<b>Please update your Strava value to match the Sauce ' +
                       'override value.</b></div>').dialog({ width: 500, modal: true });
            }
            context.ftp = ftp;
            done.dec();
        });

        done.inc();
        pageView.streamsRequest.deferred.done(function() {
            done.dec();
        });
    };

    return {
        start: start,
        moreinfo_dialog: moreinfo_dialog
    };
});


/* We have to aggressively track script loading to jack into Strava's site
 * while it's still worth altering.  E.g. Before it makes ext API calls.
 */ 
document.head.addEventListener('DOMNodeInserted', function(event) {
    if (window.pageView) {
        document.head.removeEventListener(event.type, arguments.callee);
        sauce.analysis.start();
    }
});
