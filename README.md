# Knockout Router

Knockout router is build around the knockout components. Using push state or hash to create routes, it will be able to tell knockout which component to display upon changing URL. It is an opinionated component based on the [Koco generator](https://github.com/Allov/generator-koco).

## Table of contents

- [Installation](#installation)
- [Uages](#usages)
- [Registering a page](#registering-a-page)
- [Adding a route](#adding-a-route)
- [Creating a page component](#creating-a-page-component)
    - [JavaScript UI handler](#javascript-ui-handler)
    - [HTML presentation](#html-presentation)
    - [The activator contract](#the-activator-contract)
- [Navigating event](#navigating-event)

## Installation

    bower install ko-router

## Usages

In your startup file, we need to do a number of things in order to fully initialize the router:

### startup.js

```javascript
define(['knockout', 'router'],
    function(ko, router) {
        'use strict';

        // First: registering a page.
        router.registerPage('page_name');

        // Second: add a router.
        router.addRoute('',             // First parameter is the url, in this case '/' will serve the page.
            {
                title: 'Page Title',    // The bowser title will be changed to this when routing.
                pageName: 'page_name'   // Knockout component name.
            });

        // Third: bind the Knockout ViewModel with the router object.
        ko.applyBindings({
                router: router
                // other objects come here
            });

        // Fourth: initialize the router.
        router.init();
    });
```

### index.html

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Test</title> <!-- Won't be used, router will handle page titles on its own. -->
    </head>
    <body>
        <router params="{ title: router.currentRouteTitle }"></router>
    </body>
</html>
```

## Registering a page

To register a page, you have to use the `registerPage()` function.

    registerPage(name, options)

### `name` parameter

The name of the knockout component being added.

### `options` parameter

The options to be used when creating the page.

    {
        isBower: boolean    // defines if the component comes from bower, a default bower path will be used.
        basePath: string    // the base path to be use to find the component. It has to be the root of the default files (see below).
        htmlOnly: boolean   // when creating a page, it is possible that there would be no JavaScript linked to this page, it will assume so and load the page using the naming convention (see below).
    }

## Adding a route

Route matching is mainly handled by the [byroads.js](https://github.com/W3Max/byroads.js) project.

```javascript
addRoute(pattern, routeConfig)
```
    
### `pattern` parameter

The regex pattern to be matched against when a new URL is detected.

### `routeConfig` parameter

The configuration to be used when creating the route.

    {
        title: string           // will change the browser title to this value upon routing.
        params: object          // parameters to be passed to the page component when routing. Useful when your page has dynamic content driven by parameters.
        pageName: string        // the component name used as the registerPage() name parameter.
        withActivator: boolean  // specifies whether or not the page is using an activator object.
    }

## Creating a page component

By default, register page will look in the `~/components` directory. The convention for component directory name is `[name]-page`. The `-page` may not be used when registering the page. A page component may be composed of three files:

### JavaScript UI handler

By convention, the name of this file has to be `[name]-page-ui.js`, [name] being the name of your new page. This file has to return a Knockout component structure:

```javascript
define(["text!./test-page.html", "knockout"], // beware of the first parameter where you have to define the html file to be used.
    function(template, ko) {
        'use strict';

        var ViewModel = function() {
            var self = this;

            self.title = ko.observable('Test page');

            return self;
        };

        return {
            viewModel: {
                createViewModel: function(params, componentInfo) {
                    return new ViewModel(params, componentInfo);
                }
            },
            template: template
        };
    });
```

### HTML presentation

When using a JavaScript UI handler, the name of this file has to be defined by you. However, if using the `htmlOnly` option, the component will be loading `[name]-page.html` by convention.

```javascript
<div class="container">
    <h1 class="page-header" data-bind="text: title"></h1>
    <p>This is a test page.</p>
</div>
```

### The activator contract

Sometimes, you may not want to display a page right away when changing route as you could be loading data synchronously before displaying it. To do so, you need to implement the `activator contract`.

#### The contract
* There must be an `activate` function.
* The `activate` function has to return a `jQuery promise`.
* Loading and screen transtions have to be handled by the callee.
* Rejected deferred will cause the router to stop operation and prevent the page component to be shown while falling back to the `unknownRouteHandler`.

Here's the basic structure of an activator:

```javascript
define(['jquery'],
    function($) {
        'use strict';

        var Activator = function() {
        };

        // The activate method is required to return a promise for the router.
        Activator.prototype.activate = function() {
            var deferred = new $.Deferred();

            // Here would be a good place to display a loading message.
            
            // Do something asynchronously.
            setTimeout(function() {

                // Pass the loaded data to the component.
                deferred.resolve({
                    message: 'Loaded some data...'
                });
                
                // Or you could reject the operation.
                // deferred.reject();

                // Here would be a good place to hide loading message.

            }, 2000);

            return deferred.promise();
        };

        return new Activator();
    });
```
        
## Navigating event

When navigating to a new URL, the router will raise a `navigating` event.

### Subscribing

An event may be subribed to when the router is navigating to a new URL:

    router.navigating.subscribe(handler, context)
    
#### `handler` parameter

This is the function that will be called every time the router is navigating. Returning false will cancel navigation.

#### `context` parameter

This parameter is useful to pass the `this` object when calling the handler back.

### Unsubscribing

You may unsubscribe this way:

    router.navigating.unsubscribe(handler)
    
#### `handler` parameter

The _exact_ handler passed earlier when subscribing. You may want to avoid creating inline function.
