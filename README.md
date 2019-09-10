# graphql-sqs-subscriptions

This package implements the PubSubEngine Interface from the [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) package. It allows you to connect your subscriptions manager to an AWS SQS (Simple Queue Service) queue.

## Installation

```bash
npm install graphql-sqs-subscriptions

// or

yarn install graphql-sqs-subscriptions
```

## Usage

Define your GraphQL schema with a `Subscription` type:

```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

type Subscription {
  fooAdded: Result
}

type Result {
  id: String
}
```

Create a simple `SQSPubSub` instance, passing in your AWS API keys and region:

```js
import { SQSPubSub } from "graphql-sqs-subscriptions";

const pubsub = new SQSPubSub({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION
});
```

Now, implement your Subscription resolver, using the `pubsub.asyncIterator` method, passing in the relevant trigger name:

```js
export const resolvers = {
  Subscription: {
    fooAdded: {
      subscribe: () => pubsub.asyncIterator("foo_added")
    }
  }
};
```

Calling the `asyncIterator` method will subscribe the `SQSPubSub` instance to any new message on the SQS queue.

Any time `pubsub.publish` is then called, with a matching trigger name (i.e. `"foo_added"`), GraphQL will publish the data to all subscribed clients.

```js
pubsub.publish("foo_added", { fooAdded: { id: "123" } });
```
