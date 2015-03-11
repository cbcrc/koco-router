define(['jquery', 'knockout-utilities', 'knockout', 'lodash', 'byroads', 'router-state', 'router-event'],
    function($, koUtilities, ko, _, byroads, RouterState, RouterEvent) {
        'use strict';

        function Router() {
            var self = this;

            //TODO: Créer une instance de byroads au lieu d'utiliser la static...

            koUtilities.registerComponent('router', {
                basePath: 'bower_components/knockout-router/src'
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

            self.navigatingTask = ko.observable(null);
            self._internalNavigatingTask = ko.observable(null);
            self.isNavigating = ko.observable(false);

            configureRouting(self);

            self.settings = {};

            self.routerState = new RouterState(self);
        }

        Router.prototype.init = function(settings) {
            var self = this;

            self.settings = $(self.settings).extend(settings);

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
                withActivator: false
            };

            if (pageConfig.hasOwnProperty('withActivator') && typeof pageConfig.withActivator === 'boolean') {
                page.withActivator = pageConfig.withActivator;
            }

            var componentConfig = buildComponentConfigFromPageConfig(name, pageConfig);

            page.config = koUtilities.registerComponent(componentConfig.name, componentConfig);

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

            var componentName = pattern + '-page';
            var params = {}; //Not to be confused with url params extrated by byroads.js
            var pageName = pattern;
            var title = pattern;
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

            if (!self.isRegisteredPage(pageName)) {
                throw new Error('Router.addRoute - The page \'' + pageName + '\' is not registered. Please register the page before adding a route that refers to it.');
            }

            var priority;

            if (routeConfig && routeConfig.priority) {
                priority = routeConfig.priority;
            }

            var route = byroads.addRoute(pattern, priority);

            route.params = params;
            route.componentName = componentName;
            route.pageName = pageName;
            route.title = title;
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
            var self = this;
            alert('404 - Please override the router.fail function to handle routing failure.');
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.guardRoute = function(matchedRoute, newUrl) {
            //var self = this;

            return true;
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.getPrioritizedRoute = function(matchedRoutes, newUrl) {
            //var self = this;

            return matchedRoutes[0];
        };

        Router.prototype.setPageTitle = function(matchedRoute) {
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

        //stateChanged option - for back and foward buttons (and onbeforeunload eventually)
        //Dans le cas du back or forward button, l'url doit etre remise sur la stack dans resetUrl
        Router.prototype.navigate = function(url, options) {
            var self = this;

            //so on était déjà en train de naviguer on hijack la premiere navigation (récupère le dfd) et on kill le internalDefered

            var dfd = self.navigatingTask();

            if (dfd) {
                self._internalNavigatingTask().dfd.reject('navigation hijacked');
            } else {
                dfd = new $.Deferred();
            }

            self.navigatingTask(dfd);

            var defaultOptions = {
                replace: false,
                trigger: true
            };

            options = $.extend(defaultOptions, options || {});

            var internalDfd = new $.Deferred();
            self._internalNavigatingTask({
                dfd: internalDfd,
                options: options
            });

            if (options.trigger) {
                _navigateInner(self, url);
            } else {
                var pageTitle = '';
                var currentRoute = self.currentRoute();

                if (currentRoute) {
                    pageTitle = currentRoute.pageTitle;
                }

                self.routerState.pushState({
                    pageTitle: pageTitle,
                    url: url
                }, true);
                internalDfd.resolve(currentRoute);
            }

            internalDfd
                .done(function(currentRoute) {
                    if (currentRoute) {
                        var opt = self._internalNavigatingTask().options;
                        var replace = false;

                        if (opt) {
                            replace = opt.replace;
                        }

                        self.routerState.pushState(currentRoute, replace);
                    }

                    var x = self.navigatingTask();
                    self.navigatingTask(null);
                    self._internalNavigatingTask(null);
                    x.resolve.apply(this, arguments);
                    self.isNavigating(false);
                })
                .fail(function(reason) {
                    if (reason !== 'navigation hijacked') {
                        resetUrl(self);
                        var y = self.navigatingTask();
                        self.navigatingTask(null);
                        self._internalNavigatingTask(null);
                        y.fail.apply(this, arguments);
                        self.isNavigating(false);
                    }
                });

            //TODO: S'assurer que canRoute() === false, remet l'url précédente sur back/foward button

            return dfd.promise();
        };

        function _navigateInner(self, newUrl) {
            var dfd = self._internalNavigatingTask().dfd;

            if (byroads.getNumRoutes() === 0) {
                dfd.reject('No route has been added to the router yet.');
            } else {
                self.navigating.canRoute().then(function(can) {
                    if (can) {
                        //Replace all (/.../g) leading slash (^\/) or (|) trailing slash (\/$) with an empty string.
                        newUrl = newUrl.replace(/^\/|\/$/g, '');
                        _navigateInnerInner(self, newUrl);
                    } else {
                        resetUrl(self);
                        dfd.reject('TODO: raison...');
                    }
                }, function() {
                    dfd.reject.apply(this, arguments);
                });
            }
        }

        function _navigateInnerInner(self, newUrl) {
            var dfd = self._internalNavigatingTask().dfd;
            self.isNavigating(true);
            var matchedRoutes = byroads.getMatchedRoutes(newUrl, true);
            var matchedRoute = null;

            if (matchedRoutes.length > 0) {
                matchedRoute = self.getPrioritizedRoute(matchedRoutes, newUrl);
            }

            var guardRouteResult = self.guardRoute(matchedRoute, newUrl);

            if (guardRouteResult === false) {
                resetUrl(self);
                dfd.reject('guardRoute has blocked navigation.');
                return;
            } else if (guardRouteResult === true) {
                //continue
            } else if (typeof guardRouteResult === 'string' || guardRouteResult instanceof String) {
                _navigateInner(self, guardRouteResult);
                return;
            } else {
                resetUrl(self);
                dfd.reject('guardRoute has returned an invalid value. Only string or boolean are supported.');
                return;
            }

            if (matchedRoute) {
                activate(self, matchedRoute)
                    .then(function(activationData) {
                        var finalUrl = '/' + newUrl;

                        matchedRoute.activationData = activationData;
                        matchedRoute.url = finalUrl;
                        //TODO: Simplify interface of public matchedRoute (ex. create a simpler route from matchedRoute)
                        self.currentRoute(matchedRoute);
                        self.setPageTitle(matchedRoute);
                        dfd.resolve(matchedRoute);
                    })
                    .fail(function(error) {
                        //covention pour les 404
                        if (error && error == '404') {
                            self.unknownRouteHandler( /*, reason*/ );
                        }
                        dfd.reject(error);
                    });
            } else {
                //Appeller une méthode/event sur le router pour laisser plein controle au concepteur de l'app

                //resetUrl(self);
                self.unknownRouteHandler( /*, reason*/ );
                dfd.reject('404');
            }
        }

        function activate(self, matchedRoute) {
            return new $.Deferred(function(dfd) {
                try {
                    var registeredPage = self._getRegisteredPage(matchedRoute.route.pageName);

                    if (registeredPage.withActivator) {
                        //Load activator js file (require.js) (by covention we have the filename and basePath) and call activate method on it - pass route as argument
                        //the methode activate return a promise

                        getWithRequire(registeredPage.config.require + '-activator', function(activator) {

                            if (_.isFunction(activator)) {
                                activator = new activator();
                            }

                            //activation data may have any number of properties but we require (maybe not require...) it to have pageTitle

                            activator.activate(matchedRoute)
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
                } catch (err) {
                    dfd.reject(err);
                }
            }).promise();
        }

        function configureRouting(self) {
            //TODO: Utile?
            byroads.normalizeFn = byroads.NORM_AS_OBJECT;
        }

        function resetUrl(self) {
            self.routerState.pushState(self.currentRoute(), !self._internalNavigatingTask().option.stateChanged);
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

        return new Router();
    });
