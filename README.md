# Knockout Router

Koco router is built around the knockout components. Using push state or hash to create routes, it will be able to tell knockout which component to display upon changing URL. It is an opinionated component based on the [Koco generator](https://github.com/cbcrc/generator-koco).

## Table of contents

- [Installation](#installation)
- [Uages](#usages)
- [Registering a page](#registering-a-page)
- [Adding a route](#adding-a-route)
- [Creating a page component](#creating-a-page-component)
    - [JavaScript UI handler](#javascript-ui-handler)
    - [HTML presentation](#html-presentation)
    - [The activator contract](#the-activator-contract)
- [The `context` object](#the-context-object)
- [The `route` object](#the-route-object)
- [Router state](#router-state)
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
        isBower: boolean        // defines if the component comes from bower, a default bower path will be used.
        basePath: string        // the base path to be use to find the component. It has to be the root of the default files (see below).
        htmlOnly: boolean       // when creating a page, it is possible that there would be no JavaScript linked to this page, it will assume so and load the page using the naming convention (see below).
        withActivator: boolean  // defines if the page has an activator to be used when navigating to the said page.
        activatorPath: string   // overrides the convention path for the activator file. Useful when you want to use a base activator located in a bower component.  
    }

## Adding a route

Route matching is mainly handled by the [byroads.js](https://github.com/cbcrc/byroads.js) project.

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
    }

## Creating a page component

By default, register page will look in the `~/components` directory. The convention for component directory name is `[name]-page`. The `-page` may not be used when registering the page. A page component may be composed of three files:

### JavaScript UI handler

By convention, the name of this file has to be `[name]-page-ui.js`, [name] being the name of your new page. This file has to return a Knockout component structure:

```javascript
define(['text!./test-page.html', 'knockout'], // beware of the first parameter where you have to define the html file to be used.
    function(template, ko) {
        'use strict';

        var ViewModel = function(context, componentInfo) {
            var self = this;

            self.title = ko.observable('Test page');

            return self;
        };

        return {
            viewModel: {
                createViewModel: function(context, componentInfo) {
                    return new ViewModel(context, componentInfo);
                }
            },
            template: template
        };
    });
```

### HTML presentation

When using a JavaScript UI handler, the name of this file has to be defined by you. However, if using the `htmlOnly` option, the component will be loading `[name]-page.html` by convention.

```html
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

        var Activator = function(context) {
            // Context object can be accessed here for pre-initializations. It will be then passed back to the activate function.
        };

        // The activate method is required to return a promise for the router.
        Activator.prototype.activate = function(context) {
            var deferred = new $.Deferred();

            // Here would be a good place to display a loading message.
            
            // Do something asynchronously.
            setTimeout(function() {

                // add some data to the context object as it will be passed to the page afterward.
                context.someData = { message: "Loaded some data..." };

                deferred.resolve();
                
                // Or you could reject the operation.
                // deferred.reject();

                // Here would be a good place to hide loading message.

            }, 2000);

            return deferred.promise();
        };

        return new Activator();
    });
```
        
## The `context` object

Pages and activators will receive an instance of an object representing the current context. It contains informations about the current route and the matched route.

```javascript
{
    matchedRoutes: Array, // The list of matched route using URL patterns. This is mostly for debugging purpose.
    route: Object // The current matched route object, see The route object for more informations.
}
```

## The `route` object

The route object contains informations about the current page, parameters and url parameters. It can be used an activation time or inside the page itself.

```javascript
{
    page: Object, // The page component that will be used to render the URL
    pageTitle: String, // The page title. Modifying this value inside an activator will change the page title.
    params: Object, // Parameter object passed at the registerPage call.
    pattern: String, // The URL pattern for this route. Used for debugging purpose.
    query: Object, // The Query String attached to the URL. It contains an object of the key/values pair.
    url: String, // The current URL (including Query String).
    urlParams: Array // Matched URL parameters via the described tokens in the pattern.
}
```

## Router state

Koco router has two states: `isActivating` and `isNavigating`.

The `isNavigating` state is the first to be enabled (`true`) when using `router.navigate()` or clicking a link. The router will then look for an `activator` and with enable `isActivating`.

Once the activator is done, `isActivating` will be disabled (`false`) and the page will be called (displayed). Once it is displayed, `isNavigating` will also be disabled.

```
User click on a link                     Page is displayed
v                                        v
|----------------------------------------|
  isNavigating(true)                   isNavigating(false)
  v                                    v
  |------------------------------------|
    isActivating(true) isActivating(false)
    v                  v
    |------------------|
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

```javascript
funtion preventNav() {
    return false;
}

router.navigating.subscribe(preventNav, this);
...
router.navigating.unsubscribe(preventNav);
```