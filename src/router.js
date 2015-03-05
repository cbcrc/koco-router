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

        Router.prototype.setUrlSilently = function(url) {
            var self = this;
            self.routerState.setUrlSilently(url);
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.unknownRouteHandler = function() {
            var self = this;

            //TODO: Bon format d'url - ou ca prend le #/ ???
            //self.navigate('page-non-trouvee');
            alert('404 - Please override the router.unknownRouteHandler function to handle unknown routes.');
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.guardRoute = function(matchedRoute, newUrl) {
            var self = this;

            return true;
        };

        //Cette méthode peut être overriden au besoin par le end user
        Router.prototype.getPrioritizedRoute = function(matchedRoutes, newUrl) {
            var self = this;

            return matchedRoutes[0];
        };

        Router.prototype.navigate = function(url) {
            var self = this;

            xyz(self, url);
        };

        function xyz(self, url, dfd) {
            if (self.currentRoute() && url === self.currentRoute().url) { //reload
                return self._navigate(url, dfd);
            } else {
                return self.routerState.setUrl(url, dfd);
            }
        }

        function configureRouting(self) {
            //TODO: Utile?
            byroads.normalizeFn = byroads.NORM_AS_OBJECT;
        }

        Router.prototype._navigate = function(newUrl) {
            var self = this;

            var dfd = self.navigatingTask();

            if (dfd) {
                _navigateInner(self, newUrl);
            } else {
                dfd = new $.Deferred(function(dfd) {
                    try {
                        self.navigatingTask(dfd);
                        _navigateInner(self, newUrl);
                    } catch (err) {
                        dfd.reject(err);
                    }
                }).promise();
            }

            dfd.always(function() {
                self.navigatingTask(null);
                self.isNavigating(false);
            });

            return dfd;
        };

        function _navigateInner(self, newUrl) {
            var dfd = self.navigatingTask();

            if (byroads.getNumRoutes() === 0) {
                dfd.reject('No route has been added to the router yet.');
            } else {
                if (self.resetingUrl) {
                    self.resetingUrl = false;
                    dfd.reject('TODO: raison...');
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
                    });
                }
            }
        }

        function _navigateInnerInner(self, newUrl) {
            var dfd = self.navigatingTask();
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
                _navigateInnerInner(self, guardRouteResult);
                return;
            } else {
                resetUrl(self);
                dfd.reject('guardRoute has returned an invalid value. Only string or boolean are supported.');
                return;
            }

            if (matchedRoute) {

                var navigateInnerPromise = navigateInner(self, matchedRoute);

                navigateInnerPromise
                    .then(function(activationData) {
                        var finalUrl = '/' + newUrl;

                        matchedRoute.activationData = activationData;
                        matchedRoute.url = finalUrl;
                        //TODO: Simplify interface of public matchedRoute (ex. create a simpler route from matchedRoute)
                        self.currentRoute(matchedRoute);
                        self.lastUrl = finalUrl;
                        self._setPageTitle(matchedRoute);
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

        //TODO: Allow overriding page-activator in route config

        function navigateInner(self, matchedRoute) {
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
                } catch (err) {
                    dfd.reject(err);
                }
            }).promise();
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

        return new Router();
    });
