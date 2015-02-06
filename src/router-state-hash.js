define(['hasher'],
    function(hasher) {
        'use strict';

        var RouterStateHash = function(router) {
            var self = this;

            self.router = router;
        };

        RouterStateHash.prototype.init = function() {
            var self = this;

            hasher.initialized.add(function(newHash, oldHash) {
                self.router._navigate(newHash, oldHash);
            });

            hasher.changed.add(function(newHash, oldHash) {
                self.router._navigate(newHash, oldHash);
            });

            hasher.init();
        };

        RouterStateHash.prototype.setUrlSilently = function(url) {
            hasher.changed.active = false;
            hasher.setHash(url);
            hasher.changed.active = true;
        };

        RouterStateHash.prototype.setUrl = function(url) {
            hasher.setHash(url);
        };

        RouterStateHash.prototype.setUrlWithoutGeneratingNewHistoryRecord = function(url) {
            hasher.replaceHash(url);
        };

        return RouterStateHash;
    });
