define(['jquery', 'knockout-utilities', 'knockout', 'lodash', 'crossroads', 'hasher'],
    function($, koUtilities, ko, _, crossroads, hasher) {
        'use strict';

        function Router() {
            var self = this;

            self.$document = $(document);

            koUtilities.registerComponent('router', {
                isBower: true
            });

            self.routes = [];

            self.currentRoute = ko.observable(null);

            self.currentRouteTitle = ko.computed(function() {
                var currentRoute = self.currentRoute();

                if (currentRoute) {
                    return currentRoute.title;
                }

                return '';
            });


            //TODO: ?
            //Permet d'afficher un dialog si ?dialog=dialog_name
            // self.currentRoute.subscribe(function(route) {
            //     if (route.dialog) {
            //         self.showDialog(route.dialog);
            //     }
            // });

            configureRouting(self);
        }

        Router.prototype.init = function( /*config*/ ) {
            var self = this;

            hasher.init();
        };

        Router.prototype.registerPage = function(name, pageConfig) {
            var self = this;

            if (!name) {
                throw new Error('Router.registerPage - Argument missing exception: name');
            }

            var componentConfig = buildComponentConfigFromPageConfig(name, pageConfig);
            koUtilities.registerComponent(componentConfig.name, componentConfig);

            var route = buildRoute(name, pageConfig, componentConfig);

            //il pourrait y avoir 2 urls identiques - une requireAuthentication et l'autre pas...
            if (_.any(self.routes,
                    function(r) {
                        return r.url == route.url && r.requireAuthentication == route.requireAuthentication;
                    })) {
                throw new Error('Router.registerPage - Duplicate url: ' + route.url);
            }

            crossroads.addRoute(route.url + ':?query:', function(requestParams) {
                navigate(self, route.url, requestParams);
            });

            this.routes.push(route);
        };

        Router.prototype.changeHashSilently = function(destination) {
            hasher.changed.active = false;
            hasher.setHash(destination);
            hasher.changed.active = true;
        };

        //Cette méthode peut être overrided au besoin par le end user! (on est en javascript...)
        Router.prototype.unknownRouteHandler = function() {
            var self = this;

            //TODO: Bon format d'url - ou ca prend le #/ ???
            self.navigate('page-non-trouvee');
        };

        Router.prototype.navigate = function(url) {
            var self = this;

            if (url == hasher.getHash().toLowerCase()) { //reload
                navigate(self, url);
            } else {
                hasher.setHash(url);
            }
        };

        function configureRouting(self) {
            //TODO: Utile?
            crossroads.normalizeFn = crossroads.NORM_AS_OBJECT;

            crossroads.bypassed.add(function() {
                self.unknownRouteHandler();
            });

            hasher.initialized.add(function(newHash /*, oldHash*/ ) {
                parseHash(self, newHash);
            });

            hasher.changed.add(function(newHash /*, oldHash*/ ) {
                parseHash(self, newHash);
            });
        }

        function navigate(self, url, queryParams) {

            var filteredRoutes = _.filter(self.routes,
                function(r) {
                    return r.url === url.toLowerCase();
                });

            //TODO: Supporter signedIn!
            var signedIn = false;

            var route = filteredRoutes[0];

            if (!route) {
                throw "No route has been found. Did you add one yet?";
            }

            if (filteredRoutes.length > 1) {
                route = _.first(filteredRoutes,
                    function(r) {
                        return r.requireAuthentication === signedIn;
                    });
            }

            if (route.requireAuthentication && !signedIn) {
                //todo: handle not authorized
                throw new Error('Router.navigate - TODO: (FrameworkJS) not authorized');
            } else {
                route.params.queryParams = queryParams;
                route.params.parsedQueryString = chrissRogersJQqueryDeparam(queryParams["?query_"], true);
                route.params.request = queryParams["request_"];
                route.params.queryString = queryParams["?query_"];

                //todo: si la route à un "loader" (funciton qui retourne une promesse - nom a déterminer (ex. activate)), lancer l'inititalisation... ;-) (durandal activate...)
                //afficher un loader jusqu'à la fin de l'activate
                //ou pas... la page peut afficher un loader et s'auto-initaliser...

                self.currentRoute(route);
            }
        }

        function parseHash(self, newHash) {
            //TODO..
            //self.hideCurrentDialog();

            crossroads.parse(newHash);
        }

        function buildComponentConfigFromPageConfig(name, pageConfig) {
            return {
                name: name + '-page',
                htmlOnly: pageConfig.htmlOnly,
                basePath: pageConfig.basePath,
                isBower: pageConfig.isBower,
                type: "page"
            };
        }

        function buildRoute(name, pageConfig, componentConfig) {
            var route = {
                url: name,
                params: {},
                componentName: componentConfig.name,
                name: name,
                title: name,
                excludedFromNav: false,
                hideNav: false
            };

            if (pageConfig.hasOwnProperty('url') &&
                (typeof pageConfig.url === 'string' || pageConfig.url instanceof String)) {
                route.url = pageConfig.url.toLowerCase();
            }

            if (pageConfig.hasOwnProperty('title') &&
                (typeof pageConfig.title === 'string' || pageConfig.title instanceof String)) {
                route.title = pageConfig.title;
            }

            if (pageConfig.hasOwnProperty('params') &&
                (typeof pageConfig.params === 'object' ||
                    pageConfig.params instanceof Object)) {
                route.params = pageConfig.params;
            }

            if (pageConfig.hasOwnProperty('requireAuthentication') &&
                (typeof pageConfig.requireAuthentication === 'boolean' ||
                    pageConfig.requireAuthentication instanceof Boolean)) {
                route.requireAuthentication = pageConfig.requireAuthentication;
            }

            if (pageConfig.hasOwnProperty('excludedFromNav') &&
                (typeof pageConfig.excludedFromNav === 'boolean' ||
                    pageConfig.excludedFromNav instanceof Boolean)) {
                route.excludedFromNav = pageConfig.excludedFromNav;
            }

            if (pageConfig.hasOwnProperty('hideNav') &&
                (typeof pageConfig.hideNav === 'boolean' ||
                    pageConfig.hideNav instanceof Boolean)) {
                route.hideNav = pageConfig.hideNav;
            }

            route.hash = '#/' + route.url;

            return route;
        }

        //https://github.com/chrissrogers/jquery-deparam/blob/master/jquery-deparam.js
        function chrissRogersJQqueryDeparam(params, coerce) {
            var obj = {},
                coerce_types = {
                    'true': !0,
                    'false': !1,
                    'null': null
                };

            if (params) {
                // Iterate over all name=value pairs.
                $.each(params.replace(/\+/g, ' ').split('&'), function(j, v) {
                    var param = v.split('='),
                        key = decodeURIComponent(param[0]),
                        val,
                        cur = obj,
                        i = 0,
                        // If key is more complex than 'foo', like 'a[]' or 'a[b][c]', split it
                        // into its component parts.
                        keys = key.split(']['),
                        keys_last = keys.length - 1;

                    // If the first keys part contains [ and the last ends with ], then []
                    // are correctly balanced.
                    if (/\[/.test(keys[0]) && /\]$/.test(keys[keys_last])) {
                        // Remove the trailing ] from the last keys part.
                        keys[keys_last] = keys[keys_last].replace(/\]$/, '');

                        // Split first keys part into two parts on the [ and add them back onto
                        // the beginning of the keys array.
                        keys = keys.shift().split('[').concat(keys);

                        keys_last = keys.length - 1;
                    } else {
                        // Basic 'foo' style key.
                        keys_last = 0;
                    }

                    // Are we dealing with a name=value pair, or just a name?
                    if (param.length === 2) {
                        val = decodeURIComponent(param[1]);

                        // Coerce values.
                        if (coerce) {
                            val = val && !isNaN(val) ? +val // number
                                : val === 'undefined' ? undefined // undefined
                                : coerce_types[val] !== undefined ? coerce_types[val] // true, false, null
                                : val; // string
                        }

                        if (keys_last) {
                            // Complex key, build deep object structure based on a few rules:
                            // * The 'cur' pointer starts at the object top-level.
                            // * [] = array push (n is set to array length), [n] = array if n is 
                            //   numeric, otherwise object.
                            // * If at the last keys part, set the value.
                            // * For each keys part, if the current level is undefined create an
                            //   object or array based on the type of the next keys part.
                            // * Move the 'cur' pointer to the next level.
                            // * Rinse & repeat.
                            for (; i <= keys_last; i++) {
                                key = keys[i] === '' ? cur.length : keys[i];
                                cur = cur[key] = i < keys_last ? cur[key] || (keys[i + 1] && isNaN(keys[i + 1]) ? {} : []) : val;
                            }

                        } else {
                            // Simple key, even simpler rules, since only scalars and shallow
                            // arrays are allowed.

                            if ($.isArray(obj[key])) {
                                // val is already an array, so push on the next value.
                                obj[key].push(val);

                            } else if (obj[key] !== undefined) {
                                // val isn't an array, but since a second value has been specified,
                                // convert val into an array.
                                obj[key] = [obj[key], val];

                            } else {
                                // val is a scalar.
                                obj[key] = val;
                            }
                        }

                    } else if (key) {
                        // No value was defined, so set something meaningful.
                        obj[key] = coerce ? undefined : '';
                    }
                });
            }

            return obj;
        }


        return new Router();
    });
