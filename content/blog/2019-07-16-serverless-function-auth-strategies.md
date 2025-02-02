---
title: "7 Serverless Auth Strategies for Protecting Gated Functions"
descriptions: "Gating serverless function invocations using various authentication methods"
author: DavidWells
date: 2019-07-16 09:30:00
layout: post
category: dev
tags:
  - serverless
  - javascript
---

How do we keep certain functions protected & scoped down to specific users (i.e. admin/paid users)?

In this post, we will walk through the different strategies available for authorizing access to your serverless functions.

The [code in this repo](https://github.com/DavidWells/serverless-auth-strategies/) covers AWS lambda functions primarily, but the general strategies can apply to any Functions as a service provider.

## Pick your auth provider

There are a boatload of services that provide out of the box auth for your app. It's recommended to use one of these mainly because it's quite easy to mess up some piece of the security chain rolling your own auth.

Some options out there include:

- [Auth0](https://github.com/DavidWells/serverless-auth-strategies/tree/master/providers/auth0)
- [Netlify](https://github.com/DavidWells/serverless-auth-strategies/tree/master/providers/netlify-identity)
- [AWS Cognito](https://docs.amazonaws.cn/en_us/cognito/latest/developerguide/what-is-amazon-cognito.html)
- [Okta](https://www.okta.com)
- [Firebase](https://firebase.google.com/docs/auth/)
- [... add more](https://github.com/DavidWells/serverless-auth-strategies/issues)

Rolling your own auth is ill-advised and against the serverless idea: "Focus on value to customers, not the plumbing."

Choose a provider and proceed!

## Choose a strategy

There are many ways to protect your functions.

1. [Inline auth checking](#1-inline-auth-checking)
2. [Middleware](#2-middleware)
3. ["Legacy" middleware](#3-legacy-middleware)
4. [Auth decorators](#4-auth-decorators)
5. [Custom authorizers](#5-custom-authorizers)
6. [Proxy level](#6-proxy-level)
7. [Single use access token](#7-single-use-access-token)
8. If you know of more please leave a comment on the post!

The list below will walk through them and the pros/cons of each.

### 1. Inline auth checking

Inlined function authentication happens inside your function code.

We do a check on the auth headers or the body of the request to verify the user is okay to access the function.

```js
const checkAuth = require('./utils/auth')

exports.handler = (event, context, callback) => {
  // Use the event data auth header to verify
  checkAuth(event).then((user) => {
    console.log('user', user)
    // Do stuff
    return callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        data: true
      })
    })
  }).catch((error) => {
    console.log('error', error)
    // return error back to app
    return callback(null, {
      statusCode: 401,
      body: JSON.stringify({
        error: error.message,
      })
    })
  })
}

```

**Benefits of this approach:**

- it's easy to do for a single function. Ship it!

**Drawbacks of this approach:**

- this authentication method is hard to share across multiple functions as your API grows and can lead to non-DRY code
- Caching can be a challenge, and if your authentication is an expensive operation or takes a while, this can result in a slower UX and cost you more in compute time.

### 2. Middleware

Next up, we have the middleware approach to authentication. This is still happening at the code level, but now your logic that verifies the user is allowed to access the function is abstracted up a level into reusable middleware.

MiddyJs does a great job at enabling a sane middleware approach in lambda functions.

```js
const middy = require('middy')
const authMiddleware = require('./utils/middleware')

const protectedFunction = (event, context, callback) => {
  // Do my custom stuff
  console.log('⊂◉‿◉つ This is a protected function')

  return callback(null, {
    statusCode: 200,
    body: JSON.stringify({
      data: 'auth true'
    })
  })
}

exports.handler = middy(protectedFunction).use(authMiddleware())
```

Our middy middleware looks like this:

```js
const checkAuth = require('./auth')

module.exports = function authMiddleware(config) {
  return ({
    before: (handler, next) => {
      checkAuth(handler.event).then((user) => {
        console.log('user', user)
        // set user data on event
        handler.event.user = user
        // We have the user, trigger next middleware
        return next()
      }).catch((error) => {
        console.log('error', error)
        return handler.callback(null, {
          statusCode: 401,
          body: JSON.stringify({
            error: error.message
          })
        })
      })
    }
  })
}
```

You can also instrument this yourself as seen in the movie demo(link here)

### 3. "Legacy" middleware

This middleware approach is using a familiar web framework with express PR flask and using their an auth module from their ecosystem.

In the case of express, you can use passport strategies in a lambda function.

```js
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const compression = require('compression')
const morgan = require('morgan')
const serverless = require('serverless-http')
const customLogger = require('./utils/logger')
const auth0CheckAuth = require('./utils/auth0')

/* initialize express */
const app = express()
const router = express.Router()

/*  gzip responses */
router.use(compression())

/* Setup protected routes */
router.get('/', auth0CheckAuth, (req, res) => {
  res.json({
    super: 'Secret stuff here'
  })
})

/* Attach request logger for AWS */
app.use(morgan(customLogger))

/* Attach routes to express instance */
const functionName = 'express'
const routerBasePath = (process.env.NODE_ENV === 'dev') ? `/${functionName}` : `/.netlify/functions/${functionName}/`
app.use(routerBasePath, router)

/* Apply express middlewares */
router.use(cors())
router.use(bodyParser.json())
router.use(bodyParser.urlencoded({ extended: true }))

/* Export lambda ready express app */
exports.handler = serverless(app)
```

**Benefits of this approach:**

* Leverage existing code to GSD

**Cons to this approach:**

* This takes a step backward in the "serverless" approach to doing things because you have an entire express app bootstrapping on every incoming request
* This will cost more over time with additional ms runtime because of express overhead
* This introduces the idea that monoliths can work in lambda functions and this is considered an anti-pattern

### 4. Auth decorators

Similar to auth middleware, decorators wrap the function code and return another function.

Some developers prefer this more explicit approach as opposed to middleware.

```js
@AuthDecorator // <-- ref to auth wrapper function
function protectedFunction(event, context, callback) {
  // protected logic
}
```

### 5. Custom authorizers

[Custom authorizers](https://www.alexdebrie.com/posts/lambda-custom-authorizers/) are a feature from AWS API gateway.

They are essentially another function that checks if the user is authorized to access the next function. If the auth checks out, then request then invokes the next lambda function.

**Benefits to this approach:**

- authorization can be cached with a TTL (time to live). This can save on subsequent requests where the cached authentication doesn't need to make the potential slow auth check each time. This saves on compute time, ergo saves $$

**Drawbacks to this approach:**

- you need to be using AWS API gateway to use custom authorizers

### 6. Proxy level

Similar to custom authorizers, you can verify requests at the proxy level.

This works in [Netlify](https://www.netlify.com/docs/redirects/#role-based-redirect-rules) by checking for an HTTP only secure cookie.

If the `nf_jwt` cookie exists in the request headers, Netlify will deserialize it and pass it into the context object of the lambda function.

If the cookie is no valid, you can send the request to a non-authorized endpoint (HTTP code X)

```
# If visitor has 'nf_jwt' with role set, let them see site.
/.netlify/functions/protected-function /.netlify/functions/protected-function 200! Role=*

# Else, redirect them to login portal site.
/.netlify/functions/protected-function /not-allowed 401!
```

### 7. Single-use access token

Some third-party services like AWS, and faunaDB make it possible to use single-use tokens in the client to invoke their APIs directly.

This means no function middleman to make the API calls to other services.

**Benefits to this approach:**

* Cheaper (no function runtime to pay for)
* Faster (no function latency in the middle)

**Cons to this approach:**

* More complex to setup
* Provider must support secure single-use access tokens

For more information on this approach, see [AWS Cognito](https://docs.amazonaws.cn/en_us/cognito/latest/developerguide/authentication-flow.html) docs.
