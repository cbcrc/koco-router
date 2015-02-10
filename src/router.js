define(['jquery', 'knockout-utilities', 'knockout', 'lodash', 'byroads', 'router-state', 'router-event', 'configs'],
    function($, koUtilities, ko, _, byroads, RouterState, RouterEvent, configs) {
        'use strict';

        function Router() {
            var self = this;

            //TODO: Créer une instance de byroads au lieu d'utiliser la static...

            var basePath = 'bower_components/ko-router/src';

            if (configs.koRouter && configs.koRouter.basePath) {
                basePath = configs.koRouter.basePath;
            }

            koUtilities.registerComponent('router', {
                basePath: basePath
            });

            self.currentRoute = ko.observable(null);

            self.currentRouteTitle = ko.computed(function() {
                var currentRoute = self.currentRoute();

                if (currentRoute) {
                    return currentRoute.title;
                }

                return '';
            });

            self._pages = {};

            self.navigating = new RouterEvent();


            //TODO: ?
            //Permet d'afficher un dialog si ?dialog=dialog_name
            // self.currentRoute.subscribe(function(route) {
            //     if (route.dialog) {
            //         self.showDialog(route.dialog);
            //     }
            // });

            configureRouting(self);

            self.routerState = new RouterState(self);
        }

        Router.prototype.init = function() {
            var self = this;

            self.$document = $(document);

            self.routerState.init();
        };

        Router.prototype.registerPage = function(name, pageConfig) {
            var self = this;

            if (!name) {
                throw new Error('Router.registerPage - Argument missing exception: name');
            }

            if (self.isRegisteredPage(name)) {
                throw new Error('Router.registerPage - Duplicate page: ' + name);
            }

            var componentConfig = buildComponentConfigFromPageConfig(name, pageConfig);

            this._pages[name] = koUtilities.registerComponent(componentConfig.name, componentConfig);
        };

        Router.prototype.isRegisteredPage = function(name) {
            return name in this._pages;
        };

        Router.prototype._getRegisteredPageConfigs = function(name) {
            return this._pages[name];
        };


        //routeConfig
        //priority
        //pageName
        //title
        //params


        Router.prototype.addRoute = function(pattern, routeConfig) {
            var self = this;
            routeConfig = routeConfig || {};

            //TODO: Valider que page exist else throw...

            //il pourrait y avoir 2 urls identiques - une requireAuthentication et l'autre pas...
            // if (_.any(self.routes,
            //         function(r) {
            //             return r.url == route.url && r.requireAuthentication == route.requireAuthentication;
            //         })) {
            //     throw new Error('Router.registerPage - Duplicate url: ' + route.url);
            // }

            var componentName = pattern + '-page';
            var params = {}; //Not to be confused with url params extrated by byroads.js
            var pageName = pattern;
            var title = pattern;
            var withActivator = false;
            //var requireAuthentication = false;


            if (routeConfig.hasOwnProperty('title') &&
                (typeof routeConfig.title === 'string' || routeConfig.title instanceof String)) {
                title = routeConfig.title;
            }

            if (routeConfig.hasOwnProperty('params') &&
                (typeof routeConfig.params === 'object' ||
                    routeConfig.params instanceof Object)) {
                params = routeConfig.params;
            }

            if (routeConfig.hasOwnProperty('pageName') &&
                (typeof routeConfig.pageName === 'string' || routeConfig.pageName instanceof String)) {
                pageName = routeConfig.pageName;
                componentName = routeConfig.pageName + '-page';
            }

            if (routeConfig.hasOwnProperty('withActivator') && typeof routeConfig.withActivator === 'boolean') {
                withActivator = routeConfig.withActivator;
            }

            if (!self.isRegisteredPage(pageName)) {
                throw new Error('Router.addRoute - The page \'' + pageName + '\' is not registered. Please register the page before adding a route that refers to it.');
            }

            //At worst, the pattern will serve as title...
            // if (!title || !routeConfig.activator) {
            //     throw new Error('Router.addRoute - A default title or an activator must be provided when adding a route.');
            // }

            var priority;

            if (routeConfig && routeConfig.priority) {
                priority = routeConfig.priority;
            }

            var route = byroads.addRoute(pattern, priority);

            route.params = params;
            route.componentName = componentName;
            route.pageName = pageName;
            route.title = title;
            route.withActivator = withActivator;
        };

        Router.prototype.setUrlSilently = function(url) {
            self.routerState.setUrlSilently(url);
        };

        //Cette méthode peut être overrided au besoin par le end user! (on est en javascript...)
        Router.prototype.unknownRouteHandler = function() {
            var self = this;

            //TODO: Bon format d'url - ou ca prend le #/ ???
            //self.navigate('page-non-trouvee');
            alert('404 - Please override the router.unknownRouteHandler function to handle unknown routes.');
        };

        Router.prototype.navigate = function(url) {
            var self = this;

            if (url === self.currentRoute().url) { //reload
                self._navigate(self, url);
            } else {
                self.routerState.setUrl(url);
            }
        };

        function configureRouting(self) {
            //TODO: Utile?
            byroads.normalizeFn = byroads.NORM_AS_OBJECT;

        }

        Router.prototype._navigate = function(newUrl, oldUrl) {
            var self = this;

            //Replace all (/.../g) leading slash (^\/) or (|) trailing slash (\/$) with an empty string.
            newUrl = newUrl.replace(/^\/|\/$/g, '');

            var dfd = new $.Deferred();

            if (byroads.getNumRoutes() === 0) {
                dfd.reject('No route has been added to the router yet.');
                return dfd.promise();
            }

            //TODO: Envoyer ça dans router-state?!
            if (!self.resetingUrl && !self.navigating.canRoute()) {
                resetUrl(self);
                dfd.reject('TODO: raison...');
                return dfd.promise();
            } else if (self.resetingUrl) {
                self.resetingUrl = false;
                dfd.reject('TODO: raison...');
                return dfd.promise();
            }

            var matchedRoutes = byroads.getMatchedRoutes(newUrl, true);

            //TODO: Supporter signedIn! (requireAuthenticiation fonctionnera seulement pour les routes indentiques
            //même pattern exact - on filter sur route.authenticationRequired)
            //var signedIn = false;

            if (matchedRoutes.length > 0) {
                var matchedRoute = matchedRoutes[0];
                var navigateInnerPromise = navigateInner(self, matchedRoute.route);

                navigateInnerPromise
                    .then(function(activationData) {
                        matchedRoute.activationData = activationData;
                        matchedRoute.url = newUrl;
                        self.currentRoute(matchedRoute);
                        self.lastUrl = newUrl;
                        self._setPageTitle(matchedRoute);
                        dfd.resolve(matchedRoute);
                    })
                    .fail(function(activationData) {
                        matchedRoute.activationData = activationData;
                        self.unknownRouteHandler(matchedRoute);
                        dfd.reject( /*, reason*/ );
                    });


            } else {
                //Appeller une méthode/event sur le router pour laisser plein controle au concepteur de l'app

                resetUrl(self);
                self.unknownRouteHandler( /*, reason*/ );
                dfd.reject( /*reason*/ );

            }


            //TODO: On veut toujours faire ça?
            // route.params.queryParams = queryParams;
            // route.params.parsedQueryString = chrissRogersJQqueryDeparam(queryParams["?query_"], true);
            // route.params.request = queryParams["request_"];
            // route.params.queryString = queryParams["?query_"];

            return dfd.promise();
        };

        Router.prototype._setPageTitle = function(matchedRoute) {
            var self = this;

            if (matchedRoute) {
                //todo: iiii... pas ici svp!
                //CQRS..
                matchedRoute.pageTitle = matchedRoute.route.title; /*TODO: rename pageTitle?*/

                if (matchedRoute.activationData && matchedRoute.activationData.pageTitle) {
                    matchedRoute.pageTitle = matchedRoute.activationData.pageTitle;
                }
                
                self.$document[0].title = matchedRoute.pageTitle;
            }
        };

        function resetUrl(self) {
            if (self.resetingUrl) {
                throw new Error('Already reseting url');
            } else {
                self.resetingUrl = true;
                self.routerState.setUrlWithoutGeneratingNewHistoryRecord(self.lastUrl);
            }
        }

        function navigateInner(self, matchedRoute) {
            var dfd = new $.Deferred();

            if (matchedRoute.withActivator) {
                //Load activator js file (require.js) (by covention we have the filename and basePath) and call activate method on it - pass route as argument
                //the methode activate return a promise

                var registeredPageConfigs = self._getRegisteredPageConfigs(matchedRoute.pageName);

                getWithRequire(registeredPageConfigs.require + '-activator', function(activator) {

                    //TODO: activator may be a object or function ... if function -> activator = new activator(matchedRoute)

                    var activatePromise = activator.activate(matchedRoute);

                    //activation data may have any number of properties but we require (maybe not require...) it to have pageTitle

                    activatePromise
                        .then(function(activationData) {
                            dfd.resolve(activationData);
                        })
                        .fail(function(reason) {
                            dfd.reject(reason);
                        });
                });
            } else {
                dfd.resolve(null);
            }

            return dfd.promise();
        }

        function getWithRequire(moduleName, callback) {
            require([moduleName], function(a) {
                if (a) {
                    // dev mode -- one define per file = module
                    callback(a);
                } else {
                    // optimized file -- 2nd request yields a Require module
                    require([moduleName], function(x) {
                        callback(x);
                    });
                }
            });
        }

        function buildComponentConfigFromPageConfig(name, pageConfig) {
            var componentConfig = {
                name: name + '-page',
                type: 'page'
            };

            if (pageConfig) {
                componentConfig.htmlOnly = pageConfig.htmlOnly;
                componentConfig.basePath = pageConfig.basePath;
                componentConfig.isBower = pageConfig.isBower;
            }

            return componentConfig;
        }

        //https://github.com/chrissrogers/jquery-deparam/blob/master/jquery-deparam.js
        //TODO: On ne sert plus de cette fonction actuellement dans le router...
        //NE devrait peut-être pas faire partie du core... 
        //pourrait plus faire partie d'une livrairie utilitiaire
        // function chrissRogersJQqueryDeparam(params, coerce) {
        //     var obj = {},
        //         coerce_types = {
        //             'true': !0,
        //             'false': !1,
        //             'null': null
        //         };

        //     if (params) {
        //         // Iterate over all name=value pairs.
        //         $.each(params.replace(/\+/g, ' ').split('&'), function(j, v) {
        //             var param = v.split('='),
        //                 key = decodeURIComponent(param[0]),
        //                 val,
        //                 cur = obj,
        //                 i = 0,
        //                 // If key is more complex than 'foo', like 'a[]' or 'a[b][c]', split it
        //                 // into its component parts.
        //                 keys = key.split(']['),
        //                 keys_last = keys.length - 1;

        //             // If the first keys part contains [ and the last ends with ], then []
        //             // are correctly balanced.
        //             if (/\[/.test(keys[0]) && /\]$/.test(keys[keys_last])) {
        //                 // Remove the trailing ] from the last keys part.
        //                 keys[keys_last] = keys[keys_last].replace(/\]$/, '');

        //                 // Split first keys part into two parts on the [ and add them back onto
        //                 // the beginning of the keys array.
        //                 keys = keys.shift().split('[').concat(keys);

        //                 keys_last = keys.length - 1;
        //             } else {
        //                 // Basic 'foo' style key.
        //                 keys_last = 0;
        //             }

        //             // Are we dealing with a name=value pair, or just a name?
        //             if (param.length === 2) {
        //                 val = decodeURIComponent(param[1]);

        //                 // Coerce values.
        //                 if (coerce) {
        //                     val = val && !isNaN(val) ? +val // number
        //                         : val === 'undefined' ? undefined // undefined
        //                         : coerce_types[val] !== undefined ? coerce_types[val] // true, false, null
        //                         : val; // string
        //                 }

        //                 if (keys_last) {
        //                     // Complex key, build deep object structure based on a few rules:
        //                     // * The 'cur' pointer starts at the object top-level.
        //                     // * [] = array push (n is set to array length), [n] = array if n is 
        //                     //   numeric, otherwise object.
        //                     // * If at the last keys part, set the value.
        //                     // * For each keys part, if the current level is undefined create an
        //                     //   object or array based on the type of the next keys part.
        //                     // * Move the 'cur' pointer to the next level.
        //                     // * Rinse & repeat.
        //                     for (; i <= keys_last; i++) {
        //                         key = keys[i] === '' ? cur.length : keys[i];
        //                         cur = cur[key] = i < keys_last ? cur[key] || (keys[i + 1] && isNaN(keys[i + 1]) ? {} : []) : val;
        //                     }

        //                 } else {
        //                     // Simple key, even simpler rules, since only scalars and shallow
        //                     // arrays are allowed.

        //                     if ($.isArray(obj[key])) {
        //                         // val is already an array, so push on the next value.
        //                         obj[key].push(val);

        //                     } else if (obj[key] !== undefined) {
        //                         // val isn't an array, but since a second value has been specified,
        //                         // convert val into an array.
        //                         obj[key] = [obj[key], val];

        //                     } else {
        //                         // val is a scalar.
        //                         obj[key] = val;
        //                     }
        //                 }

        //             } else if (key) {
        //                 // No value was defined, so set something meaningful.
        //                 obj[key] = coerce ? undefined : '';
        //             }
        //         });
        //     }

        //     return obj;
        // }


        return new Router();
    });
