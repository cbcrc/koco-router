define([],
    function() {
        'use strict';

        var Context = function(){
            var self = this;
            self.matchedRoutes = [];

            self.addMatchedRoute = function(route){
                self.route = route;
                self.matchedRoutes.push(route);

                self.pageTitle = route.pageTitle || route.page.title;
            };
        };

        return Context;
    });
