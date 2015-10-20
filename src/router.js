// Copyright (c) CBC/Radio-Canada. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

define(['jquery', 'knockout-utilities', 'knockout', 'lodash', 'byroads', 'router-state', './router-event',
        './context', './route'
    ],
    function($, koUtilities, ko, _, byroads, RouterState, RouterEvent, Context, Route) {
        'use strict';

        function Router() {
            var self = this;

            //TODO: Créer une instance de byroads au lieu d'utiliser la static...

            koUtilities.registerComponent('router', {
                basePath: 'bower_components/koco-router/src'
            });

            self.context = ko.observable(null);

            self._pages = {};

            self.navigating = new RouterEvent();

            self.cachedPages = {};

            self._navigatingTask = null;
            self._internalNavigatingTask = null;
            self.isNavigating = ko.observable(false);
            self.isActivating = ko.observable(false);

            configureRouting(self);

            self.settings = {
                baseUrl: '/'
            };

            self.routerState = new RouterState(self);
        }

        Router.prototype.init = function(settings) {
            var self = this;

            self.settings = $.extend({}, self.settings, settings || {});

            self.$document = $(document);

            return self.routerState.init();
        };

        Router.prototype.registerPage = function(name, pageConfig) {
            var self = this;
            pageConfig = pageConfig || {};

            if (!name) {
                throw new Error('Router.registerPage - Argument missing exception: name');
            }

            if (self.isRegisteredPage(name)) {
                throw new Error('Router.registerPage - Duplicate page: ' + name);
            }

            var page = {
                withActivator: false,
                activatorPath: '',
                name: name,
                title: pageConfig.title || ''
            };

            if (pageConfig.hasOwnProperty('withActivator') && typeof pageConfig.withActivator === 'boolean') {
                page.withActivator = pageConfig.withActivator;
            }

            if (pageConfig.hasOwnProperty('activatorPath') && typeof pageConfig.activatorPath === 'string') {
                page.activatorPath = pageConfig.activatorPath;
            }

            var componentConfig = buildComponentConfigFromPageConfig(name, pageConfig);

            var koConfig = koUtilities.registerComponent(componentConfig.name, componentConfig);

            page.componentName = componentConfig.name;
            page.require = koConfig.require;

            this._pages[name] = page;
        };

        Router.prototype.isRegisteredPage = function(name) {
            return name in this._pages;
        };

        Router.prototype._getRegisteredPage = function(name) {
            return this._pages[name];
        };

        Router.prototype.addRoute = function(pattern, routeConfig) {
            var self = this;
            routeConfig = routeConfig || {};

            //TODO: Valider que page exist else throw...
            var params = {}; //Not to be confused with url params extrated by byroads.js
            var pageName = pattern;
            var pageTitle = '';
            var cached = false;
            var rules = {};

            if (routeConfig.hasOwnProperty('cached') && typeof routeConfig.cached === 'boolean') {
                cached = routeConfig.cached;
            }

            if (routeConfig.hasOwnProperty('pageTitle') &&
                (typeof routeConfig.pageTitle === 'string' || routeConfig.pageTitle instanceof String)) {
                pageTitle = routeConfig.pageTitle;
            }

            if (routeConfig.hasOwnProperty('params') &&
                (typeof routeConfig.params === 'object' ||
                    routeConfig.params instanceof Object)) {
                params = routeConfig.params;
            }

            if (routeConfig.hasOwnProperty('pageName') &&
                (typeof routeConfig.pageName === 'string' || routeConfig.pageName instanceof String)) {
                pageName = routeConfig.pageName;
            }

            if (routeConfig.hasOwnProperty('rules') && (typeof routeConfig.rules === 'object' || routeConfig.rules instanceof Object)) {
                rules = routeConfig.rules;
            }

            if (!self.isRegisteredPage(pageName)) {
                throw new Error('Router.addRoute - The page \'' + pageName + '\' is not registered. Please register the page before adding a route that refers to it.');
            }

            var priority;

            if (routeConfig && routeConfig.priority) {
                priority = routeConfig.priority;
            }

            var route = byroads.addRoute(pattern, priority);

            //TODO: Lier la page tout de suite au lieu de le faire à chaque fois qu'on crée un Route

            route.params = params;
            route.pageName = pageName;
            route.pageTitle = pageTitle;
            route.cached = cached;
            route.rules = rules;
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.unknownRouteHandler = function() {
            //var self = this;

            //TODO: Bon format d'url - ou ca prend le #/ ???
            //self.navigate('page-non-trouvee');
            alert('404 - Please override the router.unknownRouteHandler function to handle unknown routes.');
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.fail = function() {
            //var self = this;
            alert('404 - Please override the router.fail function to handle routing failure.');
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.guardRoute = function( /*matchedRoute, newUrl*/ ) {
            //var self = this;

            return true;
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.getPrioritizedRoute = function(matchedRoutes /*, newUrl*/ ) {
            //var self = this;

            return matchedRoutes[0];
        };

        Router.prototype.setPageTitle = function(pageTitle) {
            var self = this;

            self.$document[0].title = pageTitle;
        };

        Router.prototype.setUrlSilently = function(options) {
            var self = this;

            self.routerState.pushState(options);

            var context = self.context();

            if(context && context.route)
            {
                context.route.url = options.url;
            }
        };

        //stateChanged option - for back and forward buttons (and onbeforeunload eventually)
        //Dans le cas du back or forward button, l'url doit etre remise sur la stack dans resetUrl
        Router.prototype.navigate = function(url, options) {
            var self = this;



            //so on était déjà en train de naviguer on hijack la premiere navigation (récupère le dfd) et on kill le internalDefered

            if (self._internalNavigatingTask && self._internalNavigatingTask.dfd && self._internalNavigatingTask.dfd.state() === 'pending') {
                self._internalNavigatingTask.dfd.reject('navigation hijacked');
            } else {
                self._navigatingTask = new $.Deferred();
            }



            // return new $.Deferred(function(dfd) {
            //     try {

            //     } catch (err) {
            //         dfd.reject(err);
            //     }
            // }).promise();


            setTimeout(function() {


                var defaultOptions = {
                    replace: false,
                    stateChanged: false,
                    force: false
                };

                options = $.extend(defaultOptions, options || {});

                self._internalNavigatingTask = {
                    dfd: new $.Deferred(),
                    options: options
                };

                self._internalNavigatingTask.dfd
                    .done(function(context) {
                        if (context) {
                            var pushStateOptions = toPushStateOptions(self, context, self._internalNavigatingTask.options);
                            self.routerState.pushState(pushStateOptions);

                            var previousContext = self.context();

                            if (previousContext && previousContext.route.cached) {
                                self.cachedPages[previousContext.route.url] = previousContext;
                            }

                            context.isDialog = false;
                            self.context(context);
                            self.setPageTitle(context.pageTitle);
                        }

                        self._navigatingTask.resolve.apply(this, arguments);
                        self._navigatingTask = null;
                        self._internalNavigatingTask = null;
                        self.isNavigating(false);
                    })
                    .fail(function(reason) {
                        if (reason !== 'navigation hijacked') {
                            resetUrl(self);

                            self._navigatingTask.reject.apply(this, arguments);
                            self._navigatingTask = null;
                            self._internalNavigatingTask = null;
                            self.isNavigating(false);

                            if (reason == '404') {
                                //covention pour les 404
                                //TODO: passer plus d'info... ex. url demandée originalement, url finale tenant comptre de guardRoute
                                self.unknownRouteHandler();
                            }
                        }
                    });

                if (options.force) {
                    self.isNavigating(true);
                    self._navigateInner(url, self._internalNavigatingTask.dfd, options);
                } else {
                    self.navigating.canRoute(options).then(function(can) {
                        if (can) {
                            self.isNavigating(true);
                            self._navigateInner(url, self._internalNavigatingTask.dfd, options);
                        } else {
                            resetUrl(self);
                            self._internalNavigatingTask.dfd.reject('routing cancelled by router.navigating.canRoute');
                        }
                    }, function() {
                        self._internalNavigatingTask.dfd.reject.apply(this, arguments);
                    });
                }

            }, 0);


            //TODO: S'assurer que canRoute() === false, remet l'url précédente sur back/forward button

            return self._navigatingTask.promise();
        };

        Router.prototype._navigateInner = function(newUrl, dfd, options, context) {
            var self = this;


            var defaultOptions = {
                force: false
            };

            options = $.extend(defaultOptions, options || {});

            if (!context) {
                context = new Context();
            }

            //Replace all (/.../g) leading slash (^\/) or (|) trailing slash (\/$) with an empty string.
            var cleanedUrl = newUrl.replace(/^\/|\/$/g, '');

            // Remove hash
            cleanedUrl = cleanedUrl.replace(/#.*$/g, '');

            if (byroads.getNumRoutes() === 0) {
                dfd.reject('No route has been added to the router yet.');
                return;
            }

            var matchedRoutes = byroads.getMatchedRoutes(cleanedUrl, true);
            var matchedRoute = null;

            if (matchedRoutes.length > 0) {
                matchedRoute = self.getPrioritizedRoute(convertMatchedRoutes(self, matchedRoutes, newUrl), newUrl);

                context.addMatchedRoute(matchedRoute);
            }

            var guardRouteResult = true;
            if (!options.force) {
                guardRouteResult = self.guardRoute(matchedRoute, newUrl);
            }

            if (guardRouteResult === false) {
                dfd.reject('guardRoute has blocked navigation.');
                return;
            } else if (guardRouteResult === true) {
                //continue
            } else if (typeof guardRouteResult === 'string' || guardRouteResult instanceof String) {
                self._navigateInner(guardRouteResult, dfd, options, context);
                return;
            } else {
                dfd.reject('guardRoute has returned an invalid value. Only string or boolean are supported.');
                return;
            }

            if (matchedRoute) {
                var previousContext = self.cachedPages[newUrl];

                if (previousContext) {
                    dfd.resolve(previousContext);
                } else {
                    activate(self, context)
                        .then(function(activatedContext) {
                            dfd.resolve(activatedContext);
                        })
                        .fail(function() {
                            dfd.reject.apply(this, arguments);
                        });
                }
            } else {
                dfd.reject('404');
            }
        };

        Router.prototype.currentUrl = function() {
            //var self = this;

            return window.location.pathname + window.location.search + window.location.hash;
        };

        function toPushStateOptions(self, context, options) {
            if (!context) {
                throw new Error('router.toPushStateOptions - context is mandatory');
            }

            if (!context.route) {
                throw new Error('router.toPushStateOptions - context.route is mandatory');
            }

            return {
                url: context.route.url,
                pageTitle: context.pageTitle,
                stateObject: options.stateObject || {},
                replace: options.replace || false
            };
        }

        function resetUrl(self) {
            var context = self.context();

            if (context) {
                var pushStateOptions = toPushStateOptions(self, context, {
                    replace: !self._internalNavigatingTask.options.stateChanged
                });
                self.routerState.pushState(pushStateOptions);
            }
        }

        function activate(self, context) {
            return new $.Deferred(function(dfd) {
                try {
                    var registeredPage = context.route.page;

                    if (registeredPage.withActivator) {
                        getWithRequire(registeredPage.activatorPath || (registeredPage.require + '-activator'), function(activator) {
                            if (_.isFunction(activator)) {
                                activator = new activator(context);
                            }


                            self.isActivating(true);


                            activator.activate(context)
                                .then(function() {
                                    dfd.resolve(context);
                                })
                                .fail(function(reason) {
                                    dfd.reject(reason);
                                })
                                .always(function() {
                                    self.isActivating(false);
                                });
                        });
                    } else {
                        dfd.resolve(context);
                    }
                } catch (err) {
                    dfd.reject(err);
                }
            }).promise();
        }

        function configureRouting( /*self*/ ) {
            //TODO: Utile?
            byroads.normalizeFn = byroads.NORM_AS_OBJECT;
        }

        //TODO: Allow overriding page-activator in route config

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

        function convertMatchedRoutes(self, matchedRoutes, url) {
            var result = [];

            for (var i = 0; i < matchedRoutes.length; i++) {
                var matchedRoute = matchedRoutes[i];
                var page = self._getRegisteredPage(matchedRoute.route.pageName);
                var route = new Route(url, matchedRoute, page);
                result.push(route);
            }

            return result;
        }

        return new Router();
    });
